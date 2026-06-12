import { ConfigurationError } from "@/src/entities/errors/common";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import {
  createSmsService,
  SmsConfigurationError,
} from "@/src/infrastructure/services/sms/create-sms-service";
import { isCanadianPhoneNumber, normalizePhoneNumber } from "@/src/infrastructure/services/sms/phone-number";

const TOOL_NAME = "sendSms";
const SMS_DAILY_LIMIT = 1000;


export const sendSmsHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt,
  ruleName
) => {
  const { message, phoneNumber } = action.input;
  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  const rulePrefix = ruleName ? `[${ruleName}] ` : "";

  if (!siteConfig) {
    throw new ConfigurationError("Site configuration not found");
  }

  if (!siteConfig.smsProvider) {
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}SMS provider is not configured`,
    });
    return;
  }

  if (!isCanadianPhoneNumber(phoneNumber)) {
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}SMS blocked: ${phoneNumber} is not a Canadian phone number`,
    });
    return;
  }

  // Allowlist enforcement
  const allowlist = siteConfig.smsSendAllowlist ?? [];
  if (allowlist.length === 0) {
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}SMS blocked: no approved phone numbers are configured in the SMS allowlist`,
    });
    return;
  }

  const normalizedTarget = normalizePhoneNumber(phoneNumber);
  const allowlistNormalized = allowlist
    .map((entry) => normalizePhoneNumber(entry.phoneNumber))
    .filter((n): n is string => n !== null);

  if (!normalizedTarget || !allowlistNormalized.includes(normalizedTarget)) {
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}SMS blocked: ${phoneNumber} is not in the approved phone number allowlist`,
    });
    return;
  }

  // Daily spend limit guard
  const today = new Date().toISOString().slice(0, 10);
  const currentCount =
    siteConfig.smsDailySentDate === today
      ? (siteConfig.smsDailySentCount ?? 0)
      : 0;

  if (currentCount >= SMS_DAILY_LIMIT) {
    cxt.logger.warn(
      `Daily SMS limit of ${SMS_DAILY_LIMIT} reached for tenant — skipping send to ${phoneNumber}`
    );
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Daily SMS limit (${SMS_DAILY_LIMIT}) reached — SMS to ${phoneNumber} not sent`,
    });
    return;
  }

  let smsService;
  try {
    smsService = createSmsService(siteConfig);
  } catch (err) {
    if (err instanceof SmsConfigurationError) {
      await cxt.getActivityLogEntriesRepository().create({
        ...eventContext,
        tool: TOOL_NAME,
        error: `${rulePrefix}${err.message}`,
      });
      return;
    }
    throw err;
  }

  try {
    await smsService.sendSms({ to: normalizedTarget, message });

    await cxt.getSiteConfigurationRepository().update({
      id: siteConfig.id,
      smsDailySentCount: currentCount + 1,
      smsDailySentDate: today,
    });

    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      details: `${rulePrefix}Sent SMS: "${message}" to ${phoneNumber}`,
    });
  } catch (error) {
    cxt.logger.error(`Failed to send SMS to ${phoneNumber}`, { error });
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Failed to send SMS to ${phoneNumber}`,
      details: (error as Error).message,
    });
  }
};
