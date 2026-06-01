import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import type { EmailService } from "@/src/application/services/email-service.interface";
import { defaultEmailTemplate } from "./templates/default-template";
import { getDeployUrl } from "@/src/application/services/ocean-server.utils";

export class SesEmailService implements EmailService {
  private client: SESClient;
  private fromAddress: string;
  private fromName?: string;

  constructor(config: { fromAddress: string; fromName?: string }) {
    this.fromAddress = config.fromAddress;
    this.fromName = config.fromName;
    this.client = new SESClient({
      region: process.env.AWS_REGION ?? "ca-central-1",
      credentials: fromNodeProviderChain(),
    });
  }

  async sendEmail(params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const { to, cc, bcc, subject, text, html } = params;
    const from = this.fromName
      ? `"${this.fromName}" <${this.fromAddress}>`
      : this.fromAddress;

    const toAddresses = to.split(",").map((e) => e.trim());
    const ccAddresses = cc?.split(",").map((e) => e.trim());
    const bccAddresses = bcc?.split(",").map((e) => e.trim());

    await this.client.send(
      new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: toAddresses,
          ...(ccAddresses?.length ? { CcAddresses: ccAddresses } : {}),
          ...(bccAddresses?.length ? { BccAddresses: bccAddresses } : {}),
        },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
          },
        },
      })
    );
  }

  async sendTemplatedEmail(params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    message: string;
    referralLink?: string;
  }): Promise<void> {
    const { to, cc, bcc, subject, message, referralLink } = params;

    const logoUrl = `${getDeployUrl()}/ocean-labs-logo.svg`;
    let htmlBody = defaultEmailTemplate
      .replace("{{logoUrl}}", logoUrl)
      .replace("{{{message}}}", message);

    if (referralLink) {
      htmlBody = htmlBody
        .replace("{{#if referralLink}}", "")
        .replace("{{/if}}", "");
      htmlBody = htmlBody.replace("{{referralLink}}", referralLink);
    } else {
      htmlBody = htmlBody.replace(/{{#if referralLink}}[\s\S]*?{{\/if}}/g, "");
    }

    await this.sendEmail({ to, cc, bcc, subject, text: message, html: htmlBody });
  }
}
