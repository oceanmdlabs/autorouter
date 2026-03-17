CREATE TABLE "privacy_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"actor_provider" text,
	"event_type" text NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"summary" text NOT NULL,
	"sensitive_data_encrypted" text
);
--> statement-breakpoint
CREATE INDEX "idx_privacy_audit_log_tenant_id" ON "privacy_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_privacy_audit_log_feed" ON "privacy_audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_privacy_audit_log_event_type" ON "privacy_audit_log" USING btree ("tenant_id","event_type");