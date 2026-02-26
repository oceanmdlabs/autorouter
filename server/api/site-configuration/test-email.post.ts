import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { Smtp2goEmailService } from "@/src/infrastructure/services/email/smtp2go-email-service";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { to, subject, message } = body;
  const cxt = await toApplicationContext(event);
  const logger = cxt.logger;

  // Validate required fields
  if (!to || !to.trim()) {
    return {
      success: false,
      error: "Email address is required",
    };
  }

  try {
    // Get site configuration to access email settings
    const siteConfig = await cxt
      .getSiteConfigurationRepository()
      .getForTenant();
    if (
      !siteConfig?.emailProvider ||
      !siteConfig.emailFromAddress ||
      !siteConfig.emailApiKey
    ) {
      return {
        success: false,
        error:
          "Email configuration is not set up. Please configure your email settings first.",
      };
    }

    // Create email service instance
    const emailService = new Smtp2goEmailService({
      provider: siteConfig.emailProvider,
      fromAddress: siteConfig.emailFromAddress,
      fromName: siteConfig.emailFromName ?? undefined,
      apiKey: siteConfig.emailApiKey,
    });

    // Send the test email
    await emailService.sendTemplatedEmail({
      to: to.trim(),
      subject: subject || "Test Email from Ocean Autorouter",
      message:
        message ||
        "This is a test email to verify your email configuration is working correctly.",
    });

    logger.info(`Successfully sent test email to ${to}`);
    return { success: true };
  } catch (error: any) {
    logger.error("Failed to send test email:", error);
    return {
      success: false,
      error: error.message || "Failed to send test email",
    };
  }
});
