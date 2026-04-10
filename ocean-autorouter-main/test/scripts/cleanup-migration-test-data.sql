-- =============================================================================
-- Cleanup Script for Zero-Knowledge Encryption Migration Test Data
-- =============================================================================
-- Run this after testing to remove the test data created by setup-migration-test-data.sql
-- =============================================================================

DO $$
DECLARE
    v_site_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    v_rule_id UUID := 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    v_audit_id_1 UUID := 'c3d4e5f6-a7b8-9012-cdef-123456789012';
    v_audit_id_2 UUID := 'd4e5f6a7-b8c9-0123-def0-234567890123';
BEGIN

-- Delete audit records first (foreign key considerations)
DELETE FROM llm_rule_decision_audit WHERE id IN (v_audit_id_1, v_audit_id_2);
RAISE NOTICE 'Deleted llm_rule_decision_audit records';

-- Delete routing rule
DELETE FROM routing_rules WHERE id = v_rule_id;
RAISE NOTICE 'Deleted routing_rule: %', v_rule_id;

-- Delete site config
DELETE FROM site_config WHERE id = v_site_id;
RAISE NOTICE 'Deleted site_config: %', v_site_id;

RAISE NOTICE '';
RAISE NOTICE 'Test data cleanup complete!';

END $$;

