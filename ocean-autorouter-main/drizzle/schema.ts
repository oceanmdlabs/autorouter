import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index, varchar, integer, real, customType
} from "drizzle-orm/pg-core";

// Custom type for bytea columns (binary data for encryption)
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});
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
    minutesSavedEstimate: integer("minutes_saved_estimate")
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
    tool: varchar("tool", { length: 100 }), // new varchar(100) column (nullable)
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
  "cohere", "vertex"
]);

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
    // Asymmetric Key Pair for Zero-Knowledge PHI Encryption
    // Public key in PEM format - safe to store as plaintext
    publicKey: text("public_key"),
    // Private key encrypted with Clinic Secret using AES-GCM
    encryptedPrivateKey: bytea("encrypted_private_key"),
    privateKeyIv: bytea("private_key_iv"),
    privateKeyTag: bytea("private_key_tag"),
    // Salt used for deriving encryption key from clinic secret
    privateKeySalt: bytea("private_key_salt"),
    // Whether encryption has been provisioned for this tenant
    isEncryptedSetup: boolean("is_encrypted_setup").notNull().default(false),
  },
  (table) => ({
    tenantIdx: index("idx_site_config_tenant_id").on(table.tenantId),
  })
);

// LLM Rule Decision Audit Enums
export const llmDecisionEnum = pgEnum("llm_decision", [
  "EXECUTE",
  "SKIP",
  "ERROR"
]);

export const llmValidationStatusEnum = pgEnum("llm_validation_status", [
  "VALID",
  "INVALID_JSON",
  "INVALID_SCHEMA",
  "DISALLOWED_CONTENT",
  "OTHER"
]);

export const llmToolExecutionStatusEnum = pgEnum("llm_tool_execution_status", [
  "PLANNED",
  "SUCCESS",
  "FAILED",
  "SKIPPED"
]);

// Table A: llm_rule_decision_audit
// One row per (site_id, referral_id, rule_id, evaluation_run_id)
export const llmRuleDecisionAudit = pgTable(
  "llm_rule_decision_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id").notNull(),
    referralId: text("referral_id").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleName: text("rule_name").notNull(),
    ruleVersion: text("rule_version").notNull().default("1.0"),
    decision: llmDecisionEnum("decision").notNull(),
    confidence: real("confidence"),
    reason: text("reason"),
    modelName: text("model_name"),
    modelRequestId: text("model_request_id"),
    validationStatus: llmValidationStatusEnum("validation_status").notNull(),
    validationError: text("validation_error"),
    // PHI Encryption fields for Zero-Knowledge architecture (Envelope Encryption)
    // Each row has its own DEK wrapped by the tenant's public key
    rowDekWrapped: bytea("row_dek_wrapped"),
    reasonCiphertext: bytea("reason_ciphertext"),
    reasonIv: bytea("reason_iv"),
    reasonTag: bytea("reason_tag"),
    basicReason: text("basic_reason"),
    reasonEncrypted: boolean("reason_encrypted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    siteReferralRuleIdx: index("idx_llm_rule_decision_audit_site_referral_rule").on(
      table.siteId,
      table.referralId,
      table.ruleId,
      table.createdAt
    )
  })
);

// Table B: llm_rule_tool_execution_audit
// One row per tool execution attempt, linked back to decision_audit.id
export const llmRuleToolExecutionAudit = pgTable(
  "llm_rule_tool_execution_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionAuditId: uuid("decision_audit_id")
      .notNull()
      .references(() => llmRuleDecisionAudit.id),
    siteId: text("site_id").notNull(),
    referralId: text("referral_id").notNull(),
    ruleId: text("rule_id").notNull(),
    toolIndex: integer("tool_index").notNull(),
    toolName: text("tool_name").notNull(),
    argsHash: text("args_hash"),
    status: llmToolExecutionStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    siteReferralRuleIdx: index("idx_llm_rule_tool_execution_audit_site_referral_rule").on(
      table.siteId,
      table.referralId,
      table.ruleId
    ),
    decisionToolIdx: index("idx_llm_rule_tool_execution_audit_decision_tool").on(
      table.decisionAuditId,
      table.toolIndex
    )
  })
);
