import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import { Smtp2goEmailService } from "@/src/infrastructure/services/email/smtp2go-email-service";
import { getReferralUrl } from "@/src/application/services/ocean-server.utils";

const TOOL_NAME = "sendEmail";

export const sendEmailHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt,
  ruleName
) => {
  const { to, subject, message, cc, bcc } = action.input;
  cxt.logger.info(`Planning to send email to ${to}: "${subject}"`);

  // Get site configuration to access email settings
  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  if (
    !siteConfig?.emailProvider ||
    !siteConfig.emailFromAddress ||
    !siteConfig.emailApiKey
  ) {
    const rulePrefix = ruleName ? `[${ruleName}] ` : "";
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Email configuration is not set up — attempted to send to ${to}: "${subject}"`,
    });
    return;
  }

  // Generate referral link if referral reference is available
  let referralLink: string | undefined;
  if (
    "referralRef" in eventContext &&
    eventContext.referralRef &&
    siteConfig.oceanSiteNum
  ) {
    referralLink = getReferralUrl(
      eventContext.referralRef,
      siteConfig.oceanSiteNum
    );
  }

  // Create email service instance
  const emailService = new Smtp2goEmailService({
    provider: siteConfig.emailProvider,
    fromAddress: siteConfig.emailFromAddress,
    fromName: siteConfig.emailFromName ?? undefined,
    apiKey: siteConfig.emailApiKey,
  });
  try {
    // Send the templated email
    await emailService.sendTemplatedEmail({
      to,
      cc,
      bcc,
      subject,
      message,
      referralLink,
    });
    cxt.logger.info(`Successfully sent email to ${to}: "${subject}"`);

    // Log the action
    const rulePrefix = ruleName ? `[${ruleName}] ` : "";
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      details: `${rulePrefix}Sent email to ${to}: "${subject}"`,
    });
  } catch (error) {
    cxt.logger.error(`Failed to send email to ${to}: "${subject}"`, {
      error,
    });
    const rulePrefix = ruleName ? `[${ruleName}] ` : "";
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Failed to send email to ${to}: "${subject}"`,
      details: (error as Error).message,
    });
  }
};
