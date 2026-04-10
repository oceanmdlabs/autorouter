-- =============================================================================
-- Reset Encryption for a Tenant (to re-provision with smaller RSA keys)
-- =============================================================================
-- Run this if you need to re-provision a tenant after changing key size.
-- WARNING: This will require re-encrypting all audit data!
-- =============================================================================

-- Replace this with your actual tenant ID
DO $$
DECLARE
    v_tenant_id TEXT := '105827774074359348783';  -- SnowDog Gmail tenant
    v_site_id UUID;
BEGIN

-- Find the site config for this tenant
SELECT id INTO v_site_id FROM site_config WHERE tenant_id = v_tenant_id;

IF v_site_id IS NULL THEN
    RAISE NOTICE 'No site config found for tenant: %', v_tenant_id;
    RETURN;
END IF;

RAISE NOTICE 'Resetting encryption for site: % (tenant: %)', v_site_id, v_tenant_id;

-- Reset the encryption fields in site_config
UPDATE site_config SET
    public_key = NULL,
    encrypted_private_key = NULL,
    private_key_iv = NULL,
    private_key_tag = NULL,
    private_key_salt = NULL,
    is_encrypted_setup = FALSE,
    updated_at = NOW()
WHERE id = v_site_id;

RAISE NOTICE 'Reset site_config encryption fields';

-- Reset the audit records to unencrypted state
-- This restores the plaintext reason if it was stored before encryption
-- If plaintext was already nullified, you'll need to re-generate the data
UPDATE llm_rule_decision_audit SET
    row_dek_wrapped = NULL,
    reason_ciphertext = NULL,
    reason_iv = NULL,
    reason_tag = NULL,
    basic_reason = NULL,
    reason_encrypted = FALSE
WHERE site_id = v_site_id::TEXT;

RAISE NOTICE 'Reset llm_rule_decision_audit encryption fields';
RAISE NOTICE '';
RAISE NOTICE 'Encryption reset complete!';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Go to /admin/encryption';
RAISE NOTICE '2. Provision the tenant with a new clinic secret';
RAISE NOTICE '3. The new RSA-2048 keys will be generated';

END $$;

-- Verify the reset:
-- SELECT id, name, is_encrypted_setup, public_key IS NOT NULL as has_key
-- FROM site_config WHERE tenant_id = '105827774074359348783';

