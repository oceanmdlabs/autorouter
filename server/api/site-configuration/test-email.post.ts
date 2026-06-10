import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { createEmailService } from "@/src/infrastructure/services/email/create-email-service";

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
      (siteConfig.emailProvider !== "ses" && !siteConfig.emailApiKey)
    ) {
      return {
        success: false,
        error:
          "Email configuration is not set up. Please configure your email settings first.",
      };
    }

    const emailService = createEmailService(siteConfig);

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
