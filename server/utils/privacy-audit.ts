import type { ApplicationContext } from "@/src/entities/models/application-context";
import { ApplicationContext as RuntimeApplicationContext } from "@/src/entities/models/application-context";
import type {
  NewPrivacyAuditLog,
  PrivacyAuditEventType,
} from "@/src/entities/models/privacy-audit-log";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { assertTenantAdmin } from "./tenant-access";

type LogPrivacyAuditEventArgs = {
  tenantId?: string | null;
  eventType: PrivacyAuditEventType;
  subjectType?: string | null;
  subjectId?: string | null;
  summary: string;
  sensitiveData?: unknown;
};

const siteConfigurationCategoryFields = {
  "connection settings": [
    "name",
    "oceanServer",
    "oceanSiteNum",
    "oceanClientId",
  ],
  "inbound authentication settings": ["clientId", "clientSecret"],
  "SMS settings": ["twilioAccountSid", "twilioAuthToken", "twilioPhoneNumber"],
  "AI settings": ["aiProvider", "aiApiKey", "aiModel"],
  "email settings": [
    "emailProvider",
    "emailFromAddress",
    "emailFromName",
    "emailApiKey",
    "emailSendAllowlist",
  ],
  "OpenAPI settings": [
    "siteKey",
    "siteCredential",
    "sharedEncryptionKey",
    "webhookKey",
  ],
  "eRequest archival settings": [
    "erequestArchivalEnabled",
    "erequestEnabledConfirmedAt",
    "erequestDisabledConfirmedAt",
  ],
} satisfies Record<string, string[]>;

function normalizeComparableValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

export async function logPrivacyAuditEvent(
  cxt: ApplicationContext,
  args: LogPrivacyAuditEventArgs
) {
  const user = cxt.getUser();
  const tenantId = args.tenantId ?? cxt.getTenantId();

  if (!tenantId || !user?.id) {
    return;
  }

  const targetContext =
    tenantId === cxt.getTenantId()
      ? cxt
      : createTenantScopedAuditContext(cxt, tenantId);

  const record: NewPrivacyAuditLog = {
    tenantId,
    actorUserId: user.id,
    actorName: user.name,
    actorProvider: user.provider ?? null,
    eventType: args.eventType,
    subjectType: args.subjectType ?? null,
    subjectId: args.subjectId ?? null,
    summary: args.summary,
    sensitiveData: args.sensitiveData ?? null,
  };

  await targetContext.getPrivacyAuditLogsRepository().create(record);
}

function createTenantScopedAuditContext(
  cxt: ApplicationContext,
  tenantId: string
) {
  const scopedContext = new RuntimeApplicationContext(cxt.logger);
  const user = cxt.getUser();

  scopedContext.setSession({
    user: user
      ? {
          ...user,
          activeTenantId: tenantId,
          tenantId,
        }
      : null,
  });

  return scopedContext;
}

export async function assertPrivacyAuditAccess(cxt: ApplicationContext) {
  const user = cxt.getUser();
  const tenantId = cxt.getTenantId();

  if (!user?.id || !tenantId) {
    throw createError({
      statusCode: 401,
      statusMessage: "An active tenant is required",
    });
  }

  if (user.roles.admin === "system") {
    return;
  }

  await assertTenantAdmin({
    tenantId,
    userId: user.id,
  });
}

export function summarizeSiteConfigurationChange(args: {
  before: SiteConfiguration | null;
  after: SiteConfiguration;
}) {
  const changedCategories = Object.entries(siteConfigurationCategoryFields)
    .filter(([, fields]) =>
      fields.some((field) => {
        return (
          normalizeComparableValue(
            args.before?.[field as keyof SiteConfiguration]
          ) !==
          normalizeComparableValue(args.after[field as keyof SiteConfiguration])
        );
      })
    )
    .map(([category]) => category);

  if (changedCategories.length === 0) {
    return "Updated site configuration.";
  }

  return `Updated site configuration: ${changedCategories.join(", ")}.`;
}
