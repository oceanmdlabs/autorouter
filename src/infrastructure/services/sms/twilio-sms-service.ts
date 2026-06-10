import Twilio from "twilio";
import type { SmsService } from "@/src/application/services/sms-service.interface";

export class TwilioSmsService implements SmsService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(config: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  }) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
  }

  async sendSms({ to, message }: { to: string; message: string }): Promise<void> {
    const client = Twilio(this.accountSid, this.authToken);
    const result = await client.messages.create({
      body: message,
      from: this.fromNumber,
      to,
    });
    if (result.status === "failed") {
      throw new Error(result.errorMessage ?? "Twilio SMS delivery failed");
    }
  }
}
