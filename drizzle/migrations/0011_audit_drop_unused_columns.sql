ALTER TABLE "llm_rule_decision_audit" DROP COLUMN IF EXISTS "confidence";
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN IF EXISTS "reason_code";
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN IF EXISTS "model_name";
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN IF EXISTS "model_request_id";
ALTER TABLE "llm_rule_decision_audit" DROP COLUMN IF EXISTS "validation_status";
