import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
type FhirBundle = { resourceType: "Bundle" };

// https://console.neon.tech/app/projects/spring-credit-84782882/branches/br-lingering-morning-a5h875su/tables?database=neondb

const BaseResourceSchema = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: text("updated_by").notNull(),
};

const TenantConfinedSchema = {
  tenantId: text("tenant_id").notNull(),
};

export const healthcareServices = pgTable(
  "healthcare_services",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    name: text("name").notNull(),
    description: text("description").notNull(),
    oceanReference: text("ocean_reference").notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_healthcare_services_tenant_id").on(table.tenantId),
  })
);

const routingEventTypeEnum = [
  "request_pre_submission",
  "request_received",
  "request_updated",
  "request_cancelled",
  "request_accepted",
  "request_declined",
  "request_message",
  "patient_message_forms_completion",
  "patient_note_added",
] as const;

export const triggeringEventEnum = pgEnum(
  "triggering_event",
  routingEventTypeEnum
);

export const routingRules = pgTable(
  "routing_rules",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    name: text("name").notNull(),
    triggeringEvent: triggeringEventEnum("triggering_event").notNull(),
    prompt: text("prompt").notNull(),
    active: boolean("active").notNull().default(true),
    enabledTools: jsonb("enabled_tools")
      .$type<string[]>()
      .notNull()
      .default([]),
  },
  (table) => ({
    tenantIdx: index("idx_routing_rules_tenant_id").on(table.tenantId),
  })
);

export const activityLogEntry = pgTable(
  "activity_log_entry",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    triggeringEvent: triggeringEventEnum("triggering_event"),
    referralRef: text("referral_ref"),
    requestingProvider: text("requesting_provider"),
    requestedListingTitle: text("requested_listing_title"),
    requestedListingRef: text("requested_listing_ref"),
    requestedServiceDescription: text("requested_service_description"),
    details: text("details"),
    error: text("error"),
    searchText: text("search_text").notNull().default(""),
  },
  (table) => ({
    tenantIdx: index("idx_activity_log_entry_tenant_id").on(table.tenantId),
    searchIdx: index("idx_activity_log_entry_search").on(
      table.tenantId,
      table.createdAt
    ),
    textSearchIdx: sql`CREATE INDEX IF NOT EXISTS idx_activity_log_entry_text_search ON activity_log_entry USING GIN (to_tsvector('english', search_text))`,
  })
);

export const testServiceRequests = pgTable(
  "test_service_requests",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    content: jsonb("content").notNull().$type<FhirBundle>(),
  },
  (table) => ({
    tenantIdx: index("idx_test_service_requests_tenant_id").on(table.tenantId),
  })
);

export const oceanServerEnum = pgEnum("ocean_server", [
  "ocean",
  "test",
  "staging",
  "local",
]);

export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "google",
  "cohere",
]);

export const identityProviderEnum = pgEnum("identity_provider", [
  "google",
  "github",
]);

export const tenantMembershipRoleEnum = pgEnum("tenant_membership_role", [
  "admin",
  "member",
]);

export const tenantMembershipStatusEnum = pgEnum("tenant_membership_status", [
  "active",
  "revoked",
]);

export const tenantInviteStatusEnum = pgEnum("tenant_invite_status", [
  "pending",
  "redeemed",
  "revoked",
  "expired",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: identityProviderEnum("provider").notNull(),
    subject: text("subject").notNull(),
    displayName: text("display_name").notNull(),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").notNull().default("system"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    updatedBy: text("updated_by").notNull().default("system"),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex("uidx_users_provider_subject").on(
      table.provider,
      table.subject
    ),
  })
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: tenantMembershipRoleEnum("role").notNull().default("member"),
    status: tenantMembershipStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    updatedBy: text("updated_by").notNull(),
    revokedAt: timestamp("revoked_at"),
    revokedBy: text("revoked_by"),
  },
  (table) => ({
    tenantIdx: index("idx_tenant_memberships_tenant_id").on(table.tenantId),
    userIdx: index("idx_tenant_memberships_user_id").on(table.userId),
    tenantUserUnique: uniqueIndex("uidx_tenant_memberships_tenant_user").on(
      table.tenantId,
      table.userId
    ),
  })
);

export const tenantInvites = pgTable(
  "tenant_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    code: text("code").notNull(),
    role: tenantMembershipRoleEnum("role").notNull().default("member"),
    status: tenantInviteStatusEnum("status").notNull().default("pending"),
    invitedByUserId: uuid("invited_by_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    updatedBy: text("updated_by").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    redeemedAt: timestamp("redeemed_at"),
    redeemedByUserId: uuid("redeemed_by_user_id"),
    revokedAt: timestamp("revoked_at"),
    revokedByUserId: uuid("revoked_by_user_id"),
  },
  (table) => ({
    tenantIdx: index("idx_tenant_invites_tenant_id").on(table.tenantId),
    codeUnique: uniqueIndex("uidx_tenant_invites_code").on(table.code),
    statusIdx: index("idx_tenant_invites_status").on(table.status),
  })
);

export const systemAdminAllowlist = pgTable(
  "system_admin_allowlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: identityProviderEnum("provider").notNull(),
    subject: text("subject").notNull(),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").notNull().default("system"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    updatedBy: text("updated_by").notNull().default("system"),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex(
      "uidx_system_admin_allowlist_provider_subject"
    ).on(table.provider, table.subject),
    providerActiveIdx: index("idx_system_admin_allowlist_provider_active").on(
      table.provider,
      table.active
    ),
  })
);

export const siteConfig = pgTable(
  "site_config",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    name: text("name").notNull(),
    clientId: text("client_id").notNull().unique(),
    clientSecretEncrypted: text("client_secret_hashed").notNull(),
    oceanServer: oceanServerEnum("ocean_server").notNull(),
    oceanSiteNum: text("ocean_site_num").notNull(),
    oceanClientId: text("ocean_client_id").notNull(),
    oceanClientSecretEncrypted: text("ocean_client_secret_encrypted").notNull(),
    lastSuccessfulConnection: timestamp("last_successful_connection"),
    twilioAccountSid: text("twilio_account_sid"),
    twilioAuthToken: text("twilio_auth_token"),
    twilioPhoneNumber: text("twilio_phone_number"),
    aiProvider: aiProviderEnum("ai_provider"),
    aiApiKeyEncrypted: text("ai_api_key_encrypted"),
    aiModel: text("ai_model"),
    emailProvider: text("email_provider"),
    emailApiKeyEncrypted: text("email_api_key_encrypted"),
    emailFromAddress: text("email_from_address"),
    emailFromName: text("email_from_name"),
    // Open API Credentials - Optional connection for Ocean patient engagement
    siteKeyEncrypted: text("site_key_encrypted"),
    siteCredentialEncrypted: text("site_credential_encrypted"),
    sharedEncryptionKeyEncrypted: text("shared_encryption_key_encrypted"),
    webhookKeyEncrypted: text("webhook_key_encrypted"),
    webhookUnsignedChallengeUntil: timestamp("webhook_unsigned_challenge_until"),
  },
  (table) => ({
    tenantIdx: index("idx_site_config_tenant_id").on(table.tenantId),
  })
);
