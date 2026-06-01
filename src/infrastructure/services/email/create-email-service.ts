import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import type { EmailService } from "@/src/application/services/email-service.interface";
import { Smtp2goEmailService } from "./smtp2go-email-service";
import { SesEmailService } from "./ses-email-service";

export function createEmailService(config: SiteConfiguration): EmailService {
  if (config.emailProvider === "ses") {
    return new SesEmailService({
      fromAddress: config.emailFromAddress ?? "",
      fromName: config.emailFromName ?? undefined,
    });
  }
  return new Smtp2goEmailService({
    provider: config.emailProvider ?? "smtp2go",
    fromAddress: config.emailFromAddress ?? "",
    fromName: config.emailFromName ?? undefined,
    apiKey: config.emailApiKey ?? "",
  });
}
