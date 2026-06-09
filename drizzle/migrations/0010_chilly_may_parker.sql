ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "triggered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "reasoning" text;--> statement-breakpoint
ALTER TABLE "llm_rule_tool_execution_audit" ADD COLUMN "tool_input" jsonb;--> statement-breakpoint
ALTER TABLE "llm_rule_tool_execution_audit" ADD COLUMN "tool_result" text;--> statement-breakpoint
ALTER TABLE "llm_rule_tool_execution_audit" ADD COLUMN "action_type" text;--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN "confidence";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN "reason_code";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN "model_name";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN "model_request_id";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN "validation_status";