export interface SmsService {
  sendSms(params: { to: string; message: string }): Promise<void>;
}
