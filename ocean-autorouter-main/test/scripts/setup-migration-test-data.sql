-- =============================================================================
-- Test Data Setup for Zero-Knowledge Encryption Migration Testing
-- =============================================================================
-- This script creates test data to verify the admin encryption provisioning flow:
-- 1. A site_config with NO encryption data (is_encrypted_setup = false)
-- 2. A routing rule for that site
-- 3. Two llm_rule_decision_audit records with UNENCRYPTED reason data
--
-- After running the admin provisioning with a clinic secret, the reason data
-- should be encrypted and the original reason column should be nullified.
-- =============================================================================

-- Configuration variables (change these as needed)
-- Using fixed UUIDs for easier testing
DO $$
DECLARE
    v_site_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    v_tenant_id TEXT := 'test-migration-tenant';
    v_rule_id UUID := 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    v_audit_id_1 UUID := 'c3d4e5f6-a7b8-9012-cdef-123456789012';
    v_audit_id_2 UUID := 'd4e5f6a7-b8c9-0123-def0-234567890123';
    v_now TIMESTAMP := NOW();
BEGIN

-- =============================================================================
-- 1. Create a site_config WITHOUT encryption provisioning
-- =============================================================================
INSERT INTO site_config (
    id,
    tenant_id,
    name,
    client_id,
    client_secret_hashed,
    ocean_server,
    ocean_site_num,
    ocean_client_id,
    ocean_client_secret_encrypted,
    -- Encryption fields are NULL/false
    public_key,
    encrypted_private_key,
    private_key_iv,
    private_key_tag,
    private_key_salt,
    is_encrypted_setup,
    created_at,
    updated_at,
    created_by,
    updated_by
) VALUES (
    v_site_id,
    v_tenant_id,
    'Test Migration Clinic',
    'test-client-id-migration-' || v_site_id,
    'hashed-secret-placeholder',
    'test',
    '123456',
    'ocean-client-id-placeholder',
    'encrypted-ocean-secret-placeholder',
    -- NO encryption provisioned
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    FALSE,  -- is_encrypted_setup = FALSE
    v_now,
    v_now,
    'test-script',
    'test-script'
) ON CONFLICT (id) DO UPDATE SET
    is_encrypted_setup = FALSE,
    public_key = NULL,
    encrypted_private_key = NULL,
    private_key_iv = NULL,
    private_key_tag = NULL,
    private_key_salt = NULL,
    updated_at = v_now;

RAISE NOTICE 'Created site_config: % (tenant: %)', v_site_id, v_tenant_id;

-- =============================================================================
-- 2. Create a routing rule for this site
-- =============================================================================
INSERT INTO routing_rules (
    id,
    tenant_id,
    name,
    triggering_event,
    prompt,
    active,
    enabled_tools,
    created_at,
    updated_at,
    created_by,
    updated_by
) VALUES (
    v_rule_id,
    v_tenant_id,
    'Test Migration Rule',
    'request_received',
    'This is a test rule for migration testing. Evaluate the referral and decide if it should be accepted.',
    TRUE,
    '["send_email"]',
    v_now,
    v_now,
    'test-script',
    'test-script'
) ON CONFLICT (id) DO UPDATE SET
    name = 'Test Migration Rule',
    updated_at = v_now;

RAISE NOTICE 'Created routing_rule: %', v_rule_id;

-- =============================================================================
-- 3. Create LLM decision audit records with UNENCRYPTED reason data
-- =============================================================================

-- Audit Record 1: EXECUTE decision with PHI in reason
INSERT INTO llm_rule_decision_audit (
    id,
    site_id,
    referral_id,
    rule_id,
    rule_name,
    rule_version,
    decision,
    confidence,
    reason,  -- PLAINTEXT PHI - should be encrypted after migration
    model_name,
    model_request_id,
    validation_status,
    validation_error,
    -- Encryption fields are NULL/false
    row_dek_wrapped,
    reason_ciphertext,
    reason_iv,
    reason_tag,
    basic_reason,
    reason_encrypted,
    created_at
) VALUES (
    v_audit_id_1,
    v_site_id::TEXT,
    'REF-2024-001',
    v_rule_id::TEXT,
    'Test Migration Rule',
    '1.0',
    'EXECUTE',
    0.95,
    'Patient John Smith (DOB: 1985-03-15) referred for cardiac evaluation. History of hypertension and diabetes. Recommend urgent cardiology consult based on ECG abnormalities showing possible arrhythmia.',  -- PHI!
    'gpt-4',
    'req-test-123',
    'VALID',
    NULL,
    -- NOT encrypted
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    FALSE,  -- reason_encrypted = FALSE
    v_now - INTERVAL '1 hour'
) ON CONFLICT (id) DO UPDATE SET
    reason = 'Patient John Smith (DOB: 1985-03-15) referred for cardiac evaluation. History of hypertension and diabetes. Recommend urgent cardiology consult based on ECG abnormalities showing possible arrhythmia.',
    reason_encrypted = FALSE,
    row_dek_wrapped = NULL,
    reason_ciphertext = NULL,
    reason_iv = NULL,
    reason_tag = NULL,
    basic_reason = NULL;

RAISE NOTICE 'Created llm_rule_decision_audit (unencrypted): %', v_audit_id_1;

-- Audit Record 2: SKIP decision with PHI in reason
INSERT INTO llm_rule_decision_audit (
    id,
    site_id,
    referral_id,
    rule_id,
    rule_name,
    rule_version,
    decision,
    confidence,
    reason,  -- PLAINTEXT PHI - should be encrypted after migration
    model_name,
    model_request_id,
    validation_status,
    validation_error,
    -- Encryption fields are NULL/false
    row_dek_wrapped,
    reason_ciphertext,
    reason_iv,
    reason_tag,
    basic_reason,
    reason_encrypted,
    created_at
) VALUES (
    v_audit_id_2,
    v_site_id::TEXT,
    'REF-2024-002',
    v_rule_id::TEXT,
    'Test Migration Rule',
    '1.0',
    'SKIP',
    0.88,
    'Skipping referral for Jane Doe (MRN: 12345678). The patient has already been seen by the specialist Dr. Wilson on 2024-01-10. No further action required.',  -- PHI!
    'gpt-4',
    'req-test-456',
    'VALID',
    NULL,
    -- NOT encrypted
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    FALSE,  -- reason_encrypted = FALSE
    v_now - INTERVAL '30 minutes'
) ON CONFLICT (id) DO UPDATE SET
    reason = 'Skipping referral for Jane Doe (MRN: 12345678). The patient has already been seen by the specialist Dr. Wilson on 2024-01-10. No further action required.',
    reason_encrypted = FALSE,
    row_dek_wrapped = NULL,
    reason_ciphertext = NULL,
    reason_iv = NULL,
    reason_tag = NULL,
    basic_reason = NULL;

RAISE NOTICE 'Created llm_rule_decision_audit (unencrypted): %', v_audit_id_2;

-- =============================================================================
-- Summary
-- =============================================================================
RAISE NOTICE '';
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'TEST DATA CREATED SUCCESSFULLY';
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'Site Config ID: %', v_site_id;
RAISE NOTICE 'Tenant ID: %', v_tenant_id;
RAISE NOTICE 'Rule ID: %', v_rule_id;
RAISE NOTICE 'Audit Record 1: % (EXECUTE, unencrypted)', v_audit_id_1;
RAISE NOTICE 'Audit Record 2: % (SKIP, unencrypted)', v_audit_id_2;
RAISE NOTICE '';
RAISE NOTICE 'NEXT STEPS:';
RAISE NOTICE '1. Go to /admin/encryption in the UI';
RAISE NOTICE '2. Find "Test Migration Clinic" in the pending list';
RAISE NOTICE '3. Enter a clinic secret (e.g., "test-secret-123")';
RAISE NOTICE '4. Click "Execute Provisioning"';
RAISE NOTICE '5. Verify:';
RAISE NOTICE '   - is_encrypted_setup = TRUE in site_config';
RAISE NOTICE '   - public_key is populated';
RAISE NOTICE '   - reason column is NULL in audit records';
RAISE NOTICE '   - reason_ciphertext is populated';
RAISE NOTICE '   - reason_encrypted = TRUE';
RAISE NOTICE '=============================================================================';

END $$;

-- =============================================================================
-- Verification Queries (run after migration)
-- =============================================================================

-- Check site_config encryption status:
-- SELECT id, name, is_encrypted_setup,
--        CASE WHEN public_key IS NOT NULL THEN 'YES' ELSE 'NO' END as has_public_key,
--        CASE WHEN encrypted_private_key IS NOT NULL THEN 'YES' ELSE 'NO' END as has_encrypted_private_key
-- FROM site_config
-- WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Check audit records encryption status:
-- SELECT id, referral_id, decision,
--        reason IS NOT NULL as has_plaintext_reason,
--        reason_ciphertext IS NOT NULL as has_ciphertext,
--        reason_encrypted,
--        basic_reason
-- FROM llm_rule_decision_audit
-- WHERE site_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

