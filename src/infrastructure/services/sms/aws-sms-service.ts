import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import type { SmsService } from "@/src/application/services/sms-service.interface";

export class AwsSmsService implements SmsService {
  private client: PinpointSMSVoiceV2Client;
  private originationNumber: string;

  constructor(config: { region: string; originationNumber: string }) {
    this.client = new PinpointSMSVoiceV2Client({ region: config.region });
    this.originationNumber = config.originationNumber;
  }

  async sendSms({ to, message }: { to: string; message: string }): Promise<void> {
    await this.client.send(
      new SendTextMessageCommand({
        DestinationPhoneNumber: to,
        MessageBody: message,
        OriginationIdentity: this.originationNumber,
        MessageType: "TRANSACTIONAL",
      })
    );
  }
}
