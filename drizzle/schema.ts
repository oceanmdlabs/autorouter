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
  integer,
  real,
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
    summarizeAttachmentsAcknowledged: boolean("summarize_attachments_acknowledged").notNull().default(false),
    allowedContextFields: jsonb("allowed_context_fields")
      .$type<string[]>()
      .notNull()
      .default([]),
    priority: integer("priority").notNull(),
    stopProcessingOnMatch: boolean("stop_processing_on_match").notNull().default(false),
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

export const privacyAuditLog = pgTable(
  "privacy_audit_log",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name"),
    actorProvider: text("actor_provider"),
    eventType: text("event_type").notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    summary: text("summary").notNull(),
    sensitiveDataEncrypted: text("sensitive_data_encrypted"),
  },
  (table) => ({
    tenantIdx: index("idx_privacy_audit_log_tenant_id").on(table.tenantId),
    feedIdx: index("idx_privacy_audit_log_feed").on(
      table.tenantId,
      table.createdAt
    ),
    eventIdx: index("idx_privacy_audit_log_event_type").on(
      table.tenantId,
      table.eventType
    ),
  })
);

export const llmDecisionEnum = pgEnum("llm_decision", [
  "EXECUTE",
  "SKIP",
  "ERROR",
]);

export const llmValidationStatusEnum = pgEnum("llm_validation_status", [
  "VALID",
  "INVALID_JSON",
  "INVALID_SCHEMA",
  "DISALLOWED_CONTENT",
  "OTHER",
]);

export const llmToolExecutionStatusEnum = pgEnum("llm_tool_execution_status", [
  "PLANNED",
  "SUCCESS",
  "FAILED",
  "SKIPPED",
]);

export const llmReasonCodeEnum = pgEnum("llm_reason_code", [
  "ROUTING_RULE_MATCHED",
  "NO_ACTION_NEEDED",
  "MISSING_INFORMATION",
  "OUTSIDE_SCOPE",
  "PATIENT_OPT_OUT",
  "VALIDATION_FAILED",
  "MODEL_ERROR",
]);

export const llmRuleDecisionAudit = pgTable(
  "llm_rule_decision_audit",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    siteId: text("site_id").notNull(),
    referralId: text("referral_id").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleName: text("rule_name").notNull(),
    ruleVersion: text("rule_version").notNull().default("1.0"),
    triggered: boolean("triggered").notNull().default(false),
    decision: llmDecisionEnum("decision").notNull(),
    reasonSummary: text("reason_summary"),
    reasoning: text("reasoning"),
    validationError: text("validation_error"),
  },
  (table) => ({
    tenantIdx: index("idx_llm_rule_decision_audit_tenant_id").on(table.tenantId),
    siteReferralRuleIdx: index(
      "idx_llm_rule_decision_audit_site_referral_rule"
    ).on(table.siteId, table.referralId, table.ruleId, table.createdAt),
  })
);

export const llmRuleToolExecutionAudit = pgTable(
  "llm_rule_tool_execution_audit",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    decisionAuditId: uuid("decision_audit_id")
      .notNull()
      .references(() => llmRuleDecisionAudit.id),
    siteId: text("site_id").notNull(),
    referralId: text("referral_id").notNull(),
    ruleId: text("rule_id").notNull(),
    toolIndex: integer("tool_index").notNull(),
    toolName: text("tool_name").notNull(),
    argsHash: text("args_hash"),
    toolInput: jsonb("tool_input").$type<Record<string, unknown>>(),
    toolResult: text("tool_result"),
    actionType: text("action_type"),
    status: llmToolExecutionStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
  },
  (table) => ({
    tenantIdx: index("idx_llm_rule_tool_execution_audit_tenant_id").on(
      table.tenantId
    ),
    siteReferralRuleIdx: index(
      "idx_llm_rule_tool_execution_audit_site_referral_rule"
    ).on(table.siteId, table.referralId, table.ruleId),
    decisionToolIdx: index(
      "idx_llm_rule_tool_execution_audit_decision_tool"
    ).on(table.decisionAuditId, table.toolIndex),
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
  "bedrock",
]);

export const erequestStorageProviderEnum = pgEnum(
  "erequest_storage_provider",
  ["filesystem", "s3"]
);

export const erequestStorageStatusEnum = pgEnum("erequest_storage_status", [
  "pending",
  "stored",
  "partial_failure",
  "failed",
]);

export const erequestBlobKindEnum = pgEnum("erequest_blob_kind", [
  "primary_pdf",
  "attachment",
  "other",
]);

export const erequestBlobDownloadStatusEnum = pgEnum(
  "erequest_blob_download_status",
  ["pending", "stored", "failed"]
);

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
    smsProvider: text("sms_provider"),
    smsDailySentCount: integer("sms_daily_sent_count"),
    smsDailySentDate: text("sms_daily_sent_date"),
    smsSendAllowlist: jsonb("sms_send_allowlist").$type<{ phoneNumber: string; label?: string }[]>(),
    aiProvider: aiProviderEnum("ai_provider"),
    aiApiKeyEncrypted: text("ai_api_key_encrypted"),
    aiModel: text("ai_model"),
    emailProvider: text("email_provider"),
    emailApiKeyEncrypted: text("email_api_key_encrypted"),
    emailFromAddress: text("email_from_address"),
    emailFromName: text("email_from_name"),
    emailDailySentCount: integer("email_daily_sent_count"),
    emailDailySentDate: text("email_daily_sent_date"),
    emailSendAllowlist: jsonb("email_send_allowlist").$type<string[]>(),
    // Open API Credentials - Optional connection for Ocean patient engagement
    siteKeyEncrypted: text("site_key_encrypted"),
    siteCredentialEncrypted: text("site_credential_encrypted"),
    sharedEncryptionKeyEncrypted: text("shared_encryption_key_encrypted"),
    webhookKeyEncrypted: text("webhook_key_encrypted"),
    webhookUnsignedChallengeUntil: timestamp("webhook_unsigned_challenge_until"),
    erequestArchivalEnabled: boolean("erequest_archival_enabled")
      .notNull()
      .default(false),
    erequestEnabledConfirmedAt: timestamp("erequest_enabled_confirmed_at"),
    erequestDisabledConfirmedAt: timestamp("erequest_disabled_confirmed_at"),
  },
  (table) => ({
    tenantIdx: index("idx_site_config_tenant_id").on(table.tenantId),
  })
);

export const erequests = pgTable(
  "erequests",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    sourceMessageId: text("source_message_id"),
    messageChecksum: text("message_checksum").notNull(),
    referralRef: text("referral_ref"),
    triggeringEvent: triggeringEventEnum("triggering_event").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    patientHealthNumber: text("patient_health_number"),
    patientMedicalRecordNumber: text("patient_medical_record_number"),
    patientName: text("patient_name"),
    patientFamilyName: text("patient_family_name"),
    patientGivenNames: text("patient_given_names"),
    patientDateOfBirth: timestamp("patient_date_of_birth"),
    referringProvider: text("referring_provider"),
    receivingProvider: text("receiving_provider"),
    requestedListingRef: text("requested_listing_ref"),
    requestedListingTitle: text("requested_listing_title"),
    healthServiceTypes: text("health_service_types").array().notNull().default([]),
    requestedServiceDescription: text("requested_service_description"),
    rawBundle: jsonb("raw_bundle").$type<FhirBundle | null>(),
    primaryBlobId: uuid("primary_blob_id"),
    storageStatus: erequestStorageStatusEnum("storage_status")
      .notNull()
      .default("pending"),
    ingestionError: text("ingestion_error"),
  },
  (table) => ({
    tenantReceivedIdx: index("idx_erequests_tenant_received_at").on(
      table.tenantId,
      table.receivedAt
    ),
    tenantReferralIdx: index("idx_erequests_tenant_referral_ref").on(
      table.tenantId,
      table.referralRef
    ),
    tenantHcnIdx: index("idx_erequests_tenant_health_number").on(
      table.tenantId,
      table.patientHealthNumber
    ),
    tenantMrnIdx: index("idx_erequests_tenant_mrn").on(
      table.tenantId,
      table.patientMedicalRecordNumber
    ),
    tenantReferringProviderIdx: index("idx_erequests_tenant_referring_provider").on(
      table.tenantId,
      table.referringProvider
    ),
    tenantReceivingProviderIdx: index("idx_erequests_tenant_receiving_provider").on(
      table.tenantId,
      table.receivingProvider
    ),
    tenantRequestedListingIdx: index("idx_erequests_tenant_requested_listing_ref").on(
      table.tenantId,
      table.requestedListingRef
    ),
    tenantChecksumUnique: uniqueIndex("uidx_erequests_tenant_message_checksum").on(
      table.tenantId,
      table.messageChecksum
    ),
    healthServiceTypesGinIdx: sql`CREATE INDEX IF NOT EXISTS idx_erequests_health_service_types ON erequests USING GIN (health_service_types)`,
    searchGinIdx: sql`CREATE INDEX IF NOT EXISTS idx_erequests_text_search ON erequests USING GIN (
      to_tsvector(
        'english',
        coalesce(patient_name, '') || ' ' ||
        coalesce(patient_health_number, '') || ' ' ||
        coalesce(patient_medical_record_number, '') || ' ' ||
        coalesce(referring_provider, '') || ' ' ||
        coalesce(receiving_provider, '') || ' ' ||
        coalesce(referral_ref, '') || ' ' ||
        coalesce(requested_listing_title, '') || ' ' ||
        coalesce(requested_service_description, '')
      )
    )`,
    patientNameTrigramIdx: sql`CREATE INDEX IF NOT EXISTS idx_erequests_patient_name_trgm ON erequests USING GIN (patient_name gin_trgm_ops)`,
    referringProviderTrigramIdx: sql`CREATE INDEX IF NOT EXISTS idx_erequests_referring_provider_trgm ON erequests USING GIN (referring_provider gin_trgm_ops)`,
    receivingProviderTrigramIdx: sql`CREATE INDEX IF NOT EXISTS idx_erequests_receiving_provider_trgm ON erequests USING GIN (receiving_provider gin_trgm_ops)`,
  })
);

export const erequestBlobs = pgTable(
  "erequest_blobs",
  {
    ...BaseResourceSchema,
    ...TenantConfinedSchema,
    erequestId: uuid("erequest_id").notNull(),
    kind: erequestBlobKindEnum("kind").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type"),
    byteSize: integer("byte_size").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    storageProvider: erequestStorageProviderEnum("storage_provider").notNull(),
    storageBucket: text("storage_bucket"),
    storageKey: text("storage_key").notNull(),
    sourceUrl: text("source_url"),
    downloadStatus: erequestBlobDownloadStatusEnum("download_status")
      .notNull()
      .default("pending"),
    downloadError: text("download_error"),
  },
  (table) => ({
    tenantErequestIdx: index("idx_erequest_blobs_tenant_erequest_id").on(
      table.tenantId,
      table.erequestId
    ),
    tenantKindIdx: index("idx_erequest_blobs_tenant_kind").on(
      table.tenantId,
      table.kind
    ),
    tenantStorageUnique: uniqueIndex("uidx_erequest_blobs_tenant_provider_key").on(
      table.tenantId,
      table.storageProvider,
      table.storageKey
    ),
  })
);
