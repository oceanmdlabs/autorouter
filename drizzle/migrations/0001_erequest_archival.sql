CREATE TYPE "public"."erequest_blob_download_status" AS ENUM('pending', 'stored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."erequest_blob_kind" AS ENUM('primary_pdf', 'attachment', 'other');--> statement-breakpoint
CREATE TYPE "public"."erequest_storage_provider" AS ENUM('filesystem', 's3');--> statement-breakpoint
CREATE TYPE "public"."erequest_storage_status" AS ENUM('pending', 'stored', 'partial_failure', 'failed');--> statement-breakpoint
CREATE TABLE "erequest_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"erequest_id" uuid NOT NULL,
	"kind" "erequest_blob_kind" NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"byte_size" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"storage_provider" "erequest_storage_provider" NOT NULL,
	"storage_bucket" text,
	"storage_key" text NOT NULL,
	"source_url" text,
	"download_status" "erequest_blob_download_status" DEFAULT 'pending' NOT NULL,
	"download_error" text
);
--> statement-breakpoint
CREATE TABLE "erequests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"source_message_id" text,
	"message_checksum" text NOT NULL,
	"referral_ref" text,
	"triggering_event" "triggering_event" NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"patient_health_number" text,
	"patient_medical_record_number" text,
	"patient_name" text,
	"patient_family_name" text,
	"patient_given_names" text,
	"patient_date_of_birth" timestamp,
	"referring_provider" text,
	"receiving_provider" text,
	"requested_listing_ref" text,
	"requested_listing_title" text,
	"health_service_types" text[] DEFAULT '{}' NOT NULL,
	"requested_service_description" text,
	"raw_bundle" jsonb,
	"primary_blob_id" uuid,
	"storage_status" "erequest_storage_status" DEFAULT 'pending' NOT NULL,
	"ingestion_error" text
);
--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_archival_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_storage_provider" "erequest_storage_provider" DEFAULT 'filesystem' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_store_attachments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_store_raw_bundle" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_storage_bucket" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_storage_region" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_storage_prefix" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_enabled_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "erequest_disabled_confirmed_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_erequest_blobs_tenant_erequest_id" ON "erequest_blobs" USING btree ("tenant_id","erequest_id");--> statement-breakpoint
CREATE INDEX "idx_erequest_blobs_tenant_kind" ON "erequest_blobs" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_erequest_blobs_tenant_provider_key" ON "erequest_blobs" USING btree ("tenant_id","storage_provider","storage_key");--> statement-breakpoint
CREATE INDEX "idx_erequests_tenant_received_at" ON "erequests" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE INDEX "idx_erequests_tenant_referral_ref" ON "erequests" USING btree ("tenant_id","referral_ref");--> statement-breakpoint
CREATE INDEX "idx_erequests_tenant_health_number" ON "erequests" USING btree ("tenant_id","patient_health_number");--> statement-breakpoint
CREATE INDEX "idx_erequests_tenant_mrn" ON "erequests" USING btree ("tenant_id","patient_medical_record_number");--> statement-breakpoint
CREATE INDEX "idx_erequests_tenant_referring_provider" ON "erequests" USING btree ("tenant_id","referring_provider");--> statement-breakpoint
CREATE INDEX "idx_erequests_tenant_receiving_provider" ON "erequests" USING btree ("tenant_id","receiving_provider");--> statement-breakpoint
CREATE INDEX "idx_erequests_tenant_requested_listing_ref" ON "erequests" USING btree ("tenant_id","requested_listing_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_erequests_tenant_message_checksum" ON "erequests" USING btree ("tenant_id","message_checksum");--> statement-breakpoint
CREATE INDEX "idx_erequests_health_service_types" ON "erequests" USING GIN ("health_service_types");--> statement-breakpoint
CREATE INDEX "idx_erequests_text_search" ON "erequests" USING GIN (
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
);
