import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import { createEmailService } from "@/src/infrastructure/services/email/create-email-service";
import { getReferralUrl } from "@/src/application/services/ocean-server.utils";

const TOOL_NAME = "sendEmail";
const EMAIL_DAILY_LIMIT = 1000;

export const sendEmailHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt,
  ruleName
) => {
  const { to, subject, message, cc, bcc } = action.input;
  cxt.logger.info(`Planning to send email to ${to}: "${subject}"`);

  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  const rulePrefix = ruleName ? `[${ruleName}] ` : "";

  if (
    !siteConfig?.emailProvider ||
    !siteConfig.emailFromAddress ||
    (siteConfig.emailProvider !== "ses" && !siteConfig.emailApiKey)
  ) {
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Email configuration is not set up — attempted to send to ${to}: "${subject}"`,
    });
    return;
  }

  // Allowlist enforcement — every To and CC recipient must be explicitly approved
  const allowlist = (siteConfig.emailSendAllowlist ?? []).map((e) =>
    e.toLowerCase()
  );
  const toAddresses = to.split(",").map((e) => e.trim().toLowerCase());
  const ccAddresses = cc
    ? cc.split(",").map((e) => e.trim().toLowerCase())
    : [];
  const allRecipients = [...toAddresses, ...ccAddresses];

  if (allowlist.length === 0) {
    cxt.logger.warn(`Email allowlist is empty — all agent sends are blocked`);
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Email send blocked: no approved recipients are configured (allowlist is empty)`,
    });
    return;
  }

  const blockedRecipients = allRecipients.filter(
    (addr) => !allowlist.includes(addr)
  );
  if (blockedRecipients.length > 0) {
    cxt.logger.warn(
      `Email send blocked — recipients not in allowlist: ${blockedRecipients.join(", ")}`
    );
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Email send blocked: recipient(s) not in approved allowlist: ${blockedRecipients.join(", ")}`,
    });
    return;
  }

  // Daily sending limit guard
  const today = new Date().toISOString().slice(0, 10);
  const currentCount =
    siteConfig.emailDailySentDate === today
      ? (siteConfig.emailDailySentCount ?? 0)
      : 0;

  if (currentCount >= EMAIL_DAILY_LIMIT) {
    cxt.logger.warn(
      `Daily email limit of ${EMAIL_DAILY_LIMIT} reached for tenant — skipping send to ${to}`
    );
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Daily email limit (${EMAIL_DAILY_LIMIT}) reached — email to ${to} not sent`,
    });
    return;
  }

  // Generate referral link if available
  let referralLink: string | undefined;
  if (
    "referralRef" in eventContext &&
    eventContext.referralRef &&
    siteConfig.oceanSiteNum
  ) {
    referralLink = getReferralUrl(
      eventContext.referralRef,
      siteConfig.oceanSiteNum,
      siteConfig.oceanServer ?? "ocean"
    );
  }

  const emailService = createEmailService(siteConfig);

  try {
    await emailService.sendTemplatedEmail({
      to,
      cc,
      bcc,
      subject,
      message,
      referralLink,
    });
    cxt.logger.info(`Successfully sent email to ${to}: "${subject}"`);

    // Update daily count
    await cxt.getSiteConfigurationRepository().update({
      id: siteConfig.id,
      emailDailySentCount: currentCount + 1,
      emailDailySentDate: today,
    });

    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      details: `${rulePrefix}Sent email to ${to}: "${subject}"`,
    });
  } catch (error) {
    cxt.logger.error(`Failed to send email to ${to}: "${subject}"`, { error });
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}Failed to send email to ${to}: "${subject}"`,
      details: (error as Error).message,
    });
  }
};
