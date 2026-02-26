CREATE TYPE "public"."identity_provider" AS ENUM('google', 'github');--> statement-breakpoint
CREATE TABLE "system_admin_allowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"subject" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'system' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_system_admin_allowlist_provider_subject" ON "system_admin_allowlist" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "idx_system_admin_allowlist_provider_active" ON "system_admin_allowlist" USING btree ("provider","active");