import type {
  EmailService,
  EmailConfig,
} from "@/src/application/services/email-service.interface";
import { defaultEmailTemplate } from "./templates/default-template";
import { getDeployUrl } from "@/src/application/services/ocean-server.utils";

export class Smtp2goEmailService implements EmailService {
  private config: EmailConfig;
  private readonly API_URL = "https://api.smtp2go.com/v3/email/send";

  constructor(config: EmailConfig) {
    this.config = config;
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
    const from = this.config.fromName
      ? `"${this.config.fromName}" <${this.config.fromAddress}>`
      : this.config.fromAddress;

    // Split comma-delimited email addresses and trim whitespace
    const toEmails = to.split(",").map((email) => email.trim());
    const ccEmails = cc?.split(",").map((email) => email.trim());
    const bccEmails = bcc?.split(",").map((email) => email.trim());

    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": this.config.apiKey,
      },
      body: JSON.stringify({
        sender: from,
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        subject,
        text_body: text,
        html_body: html,
      }),
    };

    const response = await fetch(this.API_URL, options);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
    }
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

    const logoUrl = `${getDeployUrl()}/symbol.png`;
    let htmlBody = defaultEmailTemplate
      .replace("{{logoUrl}}", logoUrl)
      .replace("{{{message}}}", message);

    // Handle referral link replacement
    if (referralLink) {
      htmlBody = htmlBody
        .replace("{{#if referralLink}}", "")
        .replace("{{/if}}", "");
      htmlBody = htmlBody.replace("{{referralLink}}", referralLink);
    } else {
      // Remove the entire referral link section if no link is provided
      htmlBody = htmlBody.replace(/{{#if referralLink}}[\s\S]*?{{\/if}}/g, "");
    }

    await this.sendEmail({
      to,
      cc,
      bcc,
      subject,
      text: message,
      html: htmlBody,
    });
  }
}
