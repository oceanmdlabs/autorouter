import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import type { SmsService } from "@/src/application/services/sms-service.interface";
import { TwilioSmsService } from "./twilio-sms-service";
import { AwsSmsService } from "./aws-sms-service";

export class SmsConfigurationError extends Error {}

export function createSmsService(config: SiteConfiguration): SmsService {
  if (config.smsProvider === "aws") {
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    const originationNumber = process.env.SMS_ORIGINATION_NUMBER;
    if (!region) {
      throw new SmsConfigurationError("AWS_REGION is not set");
    }
    if (!originationNumber) {
      throw new SmsConfigurationError("SMS_ORIGINATION_NUMBER is not set");
    }
    return new AwsSmsService({ region, originationNumber });
  }

  // Default: Twilio
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
    throw new SmsConfigurationError("Twilio credentials are not configured");
  }
  return new TwilioSmsService({
    accountSid: config.twilioAccountSid,
    authToken: config.twilioAuthToken,
    fromNumber: config.twilioPhoneNumber,
  });
}
