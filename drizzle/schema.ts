import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index,
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

export const routingEventTypeEnum = [
  "request_pre_submission",
  "request_received",
  "request_updated",
  "request_cancelled",
  "request_accepted",
  "request_declined",
  "request_message",
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
  },
  (table) => ({
    tenantIdx: index("idx_site_config_tenant_id").on(table.tenantId),
  })
);
