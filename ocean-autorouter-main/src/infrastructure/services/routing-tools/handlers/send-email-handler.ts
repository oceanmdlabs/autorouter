import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import { Smtp2goEmailService } from "@/src/infrastructure/services/email/smtp2go-email-service";
import { getReferralUrl } from "@/src/application/services/ocean-server.utils";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "sendEmail";

export const sendEmailHandler: RoutingToolHandler<typeof TOOL_NAME> =
  async (action, eventContext, cxt) => {
    const { to, subject, message, cc, bcc } = action.input;
    let error = null;
    // Get site configuration to access email settings
    const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
    if (
      !siteConfig?.emailProvider ||
      !siteConfig.emailFromAddress ||
      !siteConfig.emailApiKey) {

      const logDetails: LogToolEvent = {
        event: "tool.execution.error",
        message: "Failed to send email, email configuration not set up.",
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };

      cxt.logger.error(logDetails);

      return {
        tool: TOOL_NAME,
        success: false,
        error: "Email configuration is not set up",
        routingEventContext: eventContext
      };
    }

    // Generate referral link if referral reference is available
    let referralLink: string | undefined;
    if ("referralRef" in eventContext &&
      eventContext.referralRef &&
      siteConfig.oceanSiteNum) {
      referralLink = getReferralUrl(eventContext.referralRef, siteConfig.oceanSiteNum);
    }

    // Create email service instance
    const emailService = new Smtp2goEmailService({
      provider: siteConfig.emailProvider,
      fromAddress: siteConfig.emailFromAddress,
      fromName: siteConfig.emailFromName ?? undefined,
      apiKey: siteConfig.emailApiKey
    });
    try {
      // Send the templated email
      await emailService.sendTemplatedEmail({
        to,
        cc,
        bcc,
        subject,
        message,
        referralLink
      });

      const logDetails: LogToolEvent = {
        event: "tool.execution.success",
        message: "Successfully sent email",
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };

      cxt.logger.info(logDetails);

      return {
        tool: TOOL_NAME,
        success: true,
        routingEventContext: eventContext
      };
    } catch (error) {

      const logDetails: LogToolEvent = {
        event: "tool.execution.error",
        message: `Error sending email: ${String(error)}`,
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };
      cxt.logger.error(logDetails);

      return {
        tool: TOOL_NAME,
        success: false,
        error: `Error sending email: ${String(error)}`,
        routingEventContext: eventContext
      };

    }
  };
