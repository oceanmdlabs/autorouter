ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "triggered" boolean NOT NULL DEFAULT false;
ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "reasoning" text;
ALTER TABLE "llm_rule_tool_execution_audit" ADD COLUMN "tool_input" jsonb;
ALTER TABLE "llm_rule_tool_execution_audit" ADD COLUMN "tool_result" text;
ALTER TABLE "llm_rule_tool_execution_audit" ADD COLUMN "action_type" text;
