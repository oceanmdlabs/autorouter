import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import {
  createSmsService,
  SmsConfigurationError,
} from "@/src/infrastructure/services/sms/create-sms-service";
import { normalizePhoneNumber } from "@/src/infrastructure/services/sms/phone-number";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { to, message } = body;
  const cxt = await toApplicationContext(event);
  const logger = cxt.logger;

  if (!to || !to.trim()) {
    return { success: false, error: "Phone number is required" };
  }

  try {
    const siteConfig = await cxt
      .getSiteConfigurationRepository()
      .getForTenant();

    if (!siteConfig?.smsProvider) {
      return {
        success: false,
        error: "SMS provider is not configured. Please select a provider and save first.",
      };
    }

    const allowlist = siteConfig.smsSendAllowlist ?? [];
    if (allowlist.length === 0) {
      return {
        success: false,
        error: "No approved phone numbers configured. Add at least one number to the SMS allowlist before sending.",
      };
    }

    const normalizedTarget = normalizePhoneNumber(to.trim());
    const allowlistNormalized = allowlist
      .map((entry) => normalizePhoneNumber(entry.phoneNumber))
      .filter((n): n is string => n !== null);

    if (!normalizedTarget || !allowlistNormalized.includes(normalizedTarget)) {
      return {
        success: false,
        error: `${to.trim()} is not in the approved phone number allowlist.`,
      };
    }

    let smsService;
    try {
      smsService = createSmsService(siteConfig);
    } catch (err) {
      if (err instanceof SmsConfigurationError) {
        return { success: false, error: err.message };
      }
      throw err;
    }

    await smsService.sendSms({
      to: to.trim(),
      message:
        message ||
        "This is a test SMS to verify your SMS configuration is working correctly.",
    });

    logger.info(`Successfully sent test SMS to ${to}`);
    return { success: true };
  } catch (error: any) {
    logger.error("Failed to send test SMS:", error);
    return {
      success: false,
      error: error.message || "Failed to send test SMS",
    };
  }
});
