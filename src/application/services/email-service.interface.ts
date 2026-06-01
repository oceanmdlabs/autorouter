export interface EmailService {
  sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void>;

  sendTemplatedEmail(params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    message: string;
    referralLink?: string;
  }): Promise<void>;
}

export interface EmailConfig {
  provider: string;
  fromAddress: string;
  fromName?: string;
  apiKey?: string;
}
