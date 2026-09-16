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
  cxt.logger.info("Planning routing email", {
    actionId: action.id,
    ruleName: ruleName ?? null,
  });

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
      error: `${rulePrefix}EMAIL_CONFIGURATION_MISSING`,
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
  const bccAddresses = bcc
    ? bcc.split(",").map((e) => e.trim().toLowerCase())
    : [];
  const allRecipients = [...toAddresses, ...ccAddresses, ...bccAddresses];

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
    cxt.logger.warn("Email send blocked by recipient allowlist", {
      actionId: action.id,
      blockedRecipientCount: blockedRecipients.length,
    });
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}EMAIL_RECIPIENT_NOT_ALLOWLISTED`,
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
    cxt.logger.warn("Daily email limit reached", { actionId: action.id });
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}EMAIL_DAILY_LIMIT_REACHED`,
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
    cxt.logger.info("Routing email sent", { actionId: action.id });

    // Update daily count
    await cxt.getSiteConfigurationRepository().update({
      id: siteConfig.id,
      emailDailySentCount: currentCount + 1,
      emailDailySentDate: today,
    });

    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      details: `${rulePrefix}EMAIL_SENT`,
    });
  } catch (error) {
    cxt.logger.error("Routing email failed", {
      actionId: action.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      error: `${rulePrefix}EMAIL_SEND_FAILED`,
      details: null,
    });
  }
};
