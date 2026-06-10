ALTER TABLE "site_config" ADD COLUMN "sms_provider" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "sms_daily_sent_count" integer;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "sms_daily_sent_date" text;
