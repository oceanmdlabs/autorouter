import { ConfigurationError } from "@/src/entities/errors/common";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import {
  createSmsService,
  SmsConfigurationError,
} from "@/src/infrastructure/services/sms/create-sms-service";
import { normalizePhoneNumber } from "@/src/infrastructure/services/sms/phone-number";

const TOOL_NAME = "sendSms";
const SMS_DAILY_LIMIT = 1000;

// Canadian area codes (E.164: +1 followed by one of these 3-digit area codes)
const CANADIAN_AREA_CODES = new Set([
  "403", "587", "780", "825",             // Alberta
  "236", "250", "604", "672", "778",      // British Columbia
  "204", "431",                            // Manitoba
  "506",                                   // New Brunswick
  "709", "879",                            // Newfoundland & Labrador
  "867",                                   // NT / NU / YT
  "782", "902",                            // Nova Scotia / PEI
  "226", "249", "289", "343", "365", "382", "416", "437", "519", "548", "613", "647", "705", "807", "905", // Ontario
  "367", "418", "438", "450", "514", "579", "581", "819", "873",  // Quebec
  "306", "474", "639",                     // Saskatchewan
]);

function isCanadianPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // E.164 +1XXXXXXXXXX → 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return CANADIAN_AREA_CODES.has(digits.slice(1, 4));
  }
  // 10-digit local format XXXXXXXXXX
  if (digits.length === 10) {
    return CANADIAN_AREA_CODES.has(digits.slice(0, 3));
  }
  return false;
}

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
    await smsService.sendSms({ to: phoneNumber, message });

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
