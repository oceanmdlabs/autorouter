ALTER TABLE "site_config" ADD COLUMN "email_daily_sent_count" integer;
--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "email_daily_sent_date" text;
