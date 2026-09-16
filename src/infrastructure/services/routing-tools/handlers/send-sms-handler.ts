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
      error: `${rulePrefix}SMS_NON_CANADIAN_RECIPIENT`,
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
      error: `${rulePrefix}SMS_RECIPIENT_NOT_ALLOWLISTED`,
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
    cxt.logger.warn("Daily SMS limit reached", { actionId: action.id });
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}SMS_DAILY_LIMIT_REACHED`,
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
      details: `${rulePrefix}SMS_SENT`,
    });
  } catch (error) {
    cxt.logger.error("Routing SMS failed", {
      actionId: action.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}SMS_SEND_FAILED`,
      details: null,
    });
  }
};
