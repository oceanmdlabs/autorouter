import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import Twilio from "twilio";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { to, message } = body;
  const cxt = await toApplicationContext(event);
  const logger = cxt.logger;

  // Validate required fields
  if (!to || !to.trim()) {
    return {
      success: false,
      error: "Phone number is required",
    };
  }

  try {
    // Get site configuration to access SMS settings
    const siteConfig = await cxt
      .getSiteConfigurationRepository()
      .getForTenant();
    if (
      !siteConfig?.twilioAccountSid ||
      !siteConfig.twilioAuthToken ||
      !siteConfig.twilioPhoneNumber
    ) {
      return {
        success: false,
        error:
          "SMS configuration is not set up. Please configure your Twilio settings first.",
      };
    }

    // Create Twilio client
    const client = Twilio(
      siteConfig.twilioAccountSid,
      siteConfig.twilioAuthToken
    );

    // Send the test SMS
    const twilioMessage = await client.messages.create({
      body:
        message ||
        "This is a test SMS to verify your SMS configuration is working correctly.",
      from: siteConfig.twilioPhoneNumber,
      to: to.trim(),
    });

    if (twilioMessage.status === "failed") {
      return {
        success: false,
        error: twilioMessage.errorMessage || "SMS delivery failed",
      };
    }

    logger.info(`Successfully sent test SMS to ${to}`);
    return { success: true };
  } catch (error: any) {
    logger.error("Failed to send test SMS:", error);
    return {
      success: false,
      error: error.message || "Failed to send test SMS",
    };
  }
});
