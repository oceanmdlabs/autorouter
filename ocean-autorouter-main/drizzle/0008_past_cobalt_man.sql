ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "row_dek_wrapped" "bytea";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "reason_ciphertext" "bytea";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "reason_iv" "bytea";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "reason_tag" "bytea";--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "basic_reason" text;--> statement-breakpoint
ALTER TABLE "llm_rule_decision_audit" ADD COLUMN "reason_encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "public_key" text;--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "encrypted_private_key" "bytea";--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "private_key_iv" "bytea";--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "private_key_tag" "bytea";--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "private_key_salt" "bytea";--> statement-breakpoint
ALTER TABLE "site_config" ADD COLUMN "is_encrypted_setup" boolean DEFAULT false NOT NULL;