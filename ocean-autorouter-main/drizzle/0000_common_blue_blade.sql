CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'google', 'cohere');--> statement-breakpoint
CREATE TYPE "public"."ocean_server" AS ENUM('ocean', 'test', 'staging', 'local');--> statement-breakpoint
CREATE TYPE "public"."triggering_event" AS ENUM('request_pre_submission', 'request_received', 'request_updated', 'request_cancelled', 'request_accepted', 'request_declined', 'request_message');--> statement-breakpoint
CREATE TABLE "activity_log_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"triggering_event" "triggering_event",
	"referral_ref" text,
	"requesting_provider" text,
	"requested_listing_title" text,
	"requested_listing_ref" text,
	"requested_service_description" text,
	"details" text,
	"error" text,
	"search_text" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healthcare_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"ocean_reference" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"triggering_event" "triggering_event" NOT NULL,
	"prompt" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"enabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hashed" text NOT NULL,
	"ocean_server" "ocean_server" NOT NULL,
	"ocean_site_num" text NOT NULL,
	"ocean_client_id" text NOT NULL,
	"ocean_client_secret_encrypted" text NOT NULL,
	"last_successful_connection" timestamp,
	"twilio_account_sid" text,
	"twilio_auth_token" text,
	"twilio_phone_number" text,
	"ai_provider" "ai_provider",
	"ai_api_key_encrypted" text,
	"ai_model" text,
	"email_provider" text,
	"email_api_key_encrypted" text,
	"email_from_address" text,
	"email_from_name" text,
	CONSTRAINT "site_config_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "test_service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"content" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_activity_log_entry_tenant_id" ON "activity_log_entry" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_activity_log_entry_search" ON "activity_log_entry" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_healthcare_services_tenant_id" ON "healthcare_services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_routing_rules_tenant_id" ON "routing_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_site_config_tenant_id" ON "site_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_test_service_requests_tenant_id" ON "test_service_requests" USING btree ("tenant_id");