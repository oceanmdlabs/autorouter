CREATE TYPE "public"."llm_decision" AS ENUM('EXECUTE', 'SKIP', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."llm_tool_execution_status" AS ENUM('PLANNED', 'SUCCESS', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."llm_validation_status" AS ENUM('VALID', 'INVALID_JSON', 'INVALID_SCHEMA', 'DISALLOWED_CONTENT', 'OTHER');--> statement-breakpoint
CREATE TABLE "llm_rule_decision_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" text NOT NULL,
	"referral_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"rule_name" text NOT NULL,
	"rule_version" text DEFAULT '1.0' NOT NULL,
	"decision" "llm_decision" NOT NULL,
	"confidence" real,
	"reason" text,
	"model_name" text,
	"model_request_id" text,
	"validation_status" "llm_validation_status" NOT NULL,
	"validation_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_rule_tool_execution_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_audit_id" uuid NOT NULL,
	"site_id" text NOT NULL,
	"referral_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"tool_index" integer NOT NULL,
	"tool_name" text NOT NULL,
	"args_hash" text,
	"status" "llm_tool_execution_status" NOT NULL,
	"error_code" text,
	"error_summary" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_rule_tool_execution_audit" ADD CONSTRAINT "llm_rule_tool_execution_audit_decision_audit_id_llm_rule_decision_audit_id_fk" FOREIGN KEY ("decision_audit_id") REFERENCES "public"."llm_rule_decision_audit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_llm_rule_decision_audit_site_referral_rule" ON "llm_rule_decision_audit" USING btree ("site_id","referral_id","rule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_llm_rule_tool_execution_audit_site_referral_rule" ON "llm_rule_tool_execution_audit" USING btree ("site_id","referral_id","rule_id");--> statement-breakpoint
CREATE INDEX "idx_llm_rule_tool_execution_audit_decision_tool" ON "llm_rule_tool_execution_audit" USING btree ("decision_audit_id","tool_index");