ALTER TYPE "public"."triggering_event" ADD VALUE IF NOT EXISTS 'patient_message_forms_completion';--> statement-breakpoint
ALTER TYPE "public"."triggering_event" ADD VALUE IF NOT EXISTS 'patient_note_added';--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "site_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "site_credential_encrypted" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "shared_encryption_key_encrypted" text;