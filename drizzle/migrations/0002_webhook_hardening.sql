ALTER TABLE "site_config" ADD COLUMN "webhook_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "webhook_unsigned_challenge_until" timestamp;
