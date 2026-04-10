-- =============================================================================
-- Verification Queries for Zero-Knowledge Encryption Testing
-- =============================================================================
-- Run these queries to verify the encryption flows are working correctly.
-- =============================================================================

-- =============================================================================
-- 1. CHECK SITE CONFIG ENCRYPTION STATUS
-- =============================================================================
-- After provisioning, should show:
-- - is_encrypted_setup = TRUE
-- - has_public_key = YES
-- - has_encrypted_private_key = YES

SELECT
    id,
    name,
    tenant_id,
    is_encrypted_setup,
    CASE WHEN public_key IS NOT NULL THEN 'YES' ELSE 'NO' END as has_public_key,
    CASE WHEN encrypted_private_key IS NOT NULL THEN 'YES' ELSE 'NO' END as has_encrypted_private_key,
    CASE WHEN private_key_salt IS NOT NULL THEN 'YES' ELSE 'NO' END as has_salt,
    created_at
FROM site_config
ORDER BY created_at DESC
LIMIT 10;


-- =============================================================================
-- 2. CHECK AUDIT RECORDS ENCRYPTION STATUS
-- =============================================================================
-- After provisioning/migration, should show:
-- - has_plaintext_reason = FALSE (reason column is NULL)
-- - has_row_dek = YES (row_dek_wrapped is populated)
-- - has_ciphertext = YES (reason_ciphertext is populated)
-- - reason_encrypted = TRUE
-- - basic_reason has a non-PHI summary

SELECT
    id,
    site_id,
    referral_id,
    decision,
    LEFT(reason, 50) as reason_preview,  -- Should be NULL after migration
    reason IS NOT NULL as has_plaintext_reason,
    row_dek_wrapped IS NOT NULL as has_row_dek,
    reason_ciphertext IS NOT NULL as has_ciphertext,
    reason_encrypted,
    basic_reason,
    created_at
FROM llm_rule_decision_audit
ORDER BY created_at DESC
LIMIT 20;


-- =============================================================================
-- 3. CHECK TEST MIGRATION DATA SPECIFICALLY
-- =============================================================================
SELECT
    lda.id as audit_id,
    lda.referral_id,
    lda.decision,
    lda.reason IS NOT NULL as has_plaintext,
    lda.reason_encrypted,
    lda.basic_reason,
    sc.name as site_name,
    sc.is_encrypted_setup
FROM llm_rule_decision_audit lda
JOIN site_config sc ON lda.site_id = sc.id::TEXT
WHERE sc.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY lda.created_at;


-- =============================================================================
-- 4. COUNT ENCRYPTED VS UNENCRYPTED BY SITE
-- =============================================================================
SELECT
    sc.name as site_name,
    sc.is_encrypted_setup,
    COUNT(*) as total_records,
    SUM(CASE WHEN lda.reason_encrypted THEN 1 ELSE 0 END) as encrypted_count,
    SUM(CASE WHEN NOT lda.reason_encrypted AND lda.reason IS NOT NULL THEN 1 ELSE 0 END) as unencrypted_with_reason,
    SUM(CASE WHEN NOT lda.reason_encrypted AND lda.reason IS NULL THEN 1 ELSE 0 END) as unencrypted_no_reason
FROM site_config sc
LEFT JOIN llm_rule_decision_audit lda ON lda.site_id = sc.id::TEXT
GROUP BY sc.id, sc.name, sc.is_encrypted_setup
ORDER BY sc.name;


-- =============================================================================
-- 5. VERIFY NEW RECORDS ARE ENCRYPTED (for new registration flow)
-- =============================================================================
-- After creating a new site with clinic secret and running an LLM decision,
-- new records should automatically be encrypted.

SELECT
    lda.id,
    lda.referral_id,
    lda.decision,
    lda.reason IS NULL as plaintext_nullified,
    lda.row_dek_wrapped IS NOT NULL as has_wrapped_dek,
    lda.reason_ciphertext IS NOT NULL as has_ciphertext,
    lda.reason_encrypted,
    lda.basic_reason,
    lda.created_at
FROM llm_rule_decision_audit lda
JOIN site_config sc ON lda.site_id = sc.id::TEXT
WHERE sc.is_encrypted_setup = TRUE
ORDER BY lda.created_at DESC
LIMIT 10;

