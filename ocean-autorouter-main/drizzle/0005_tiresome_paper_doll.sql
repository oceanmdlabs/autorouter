ALTER TABLE "activity_log_entry" ADD COLUMN IF NOT EXISTS "tool" varchar(100);--> statement-breakpoint
ALTER TABLE "activity_log_entry" DROP COLUMN IF EXISTS "details";