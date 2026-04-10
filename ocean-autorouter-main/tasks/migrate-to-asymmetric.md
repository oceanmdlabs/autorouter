## Migration GOAL

- use asymmetric encryption to protect PHI data in the audit logs
- eliminate the need for symmetric key management by using public/private key pairs
- the private key will be encrypted with a clinic-specific secret, ensuring only authorized access
- this means that data can be encrypted at any time using the public key, without needing access to the private key

## Context

- I have deleted the last schema migration that added symmetric DEK management so we can change the schema.ts and
  generate
  a new single migration that implements the asymmetric model from scratch, the changes were only made in dev so no
  production data is affected.

- hopefully we can reuse the UI and logic from the first migration plan but adapt it to the asymmetric model.
- we will do this one phase at a time.

## The "Clean Slate" Implementation Plan: Asymmetric PHI Security

This plan replaces all previous symmetric logic with a **Zero-Knowledge Asymmetric (RSA-4096 or ECC) Model**.

### Phase 1: Consolidated Database Migration

You will create one migration that prepares both the Tenant configuration and the Audit records.

#### 1.1 `site_config` (The Key Locker)

We need to store the asymmetric key pair and the "Wrapped" Data Encryption Key.

| Column                  | Type             | Description                                                        |
|-------------------------|------------------|--------------------------------------------------------------------|
| `public_key`            | `TEXT`           | The RSA Public Key (PEM format). Safe to be plaintext.             |
| `encrypted_private_key` | `VARBINARY(max)` | The RSA Private Key, encrypted by the **Clinic Secret** (AES-GCM). |
| `private_key_iv`        | `BINARY(12)`     | IV for the Private Key encryption.                                 |
| `private_key_tag`       | `BINARY(16)`     | Auth Tag for the Private Key encryption.                           |
| `tenant_dek_wrapped`    | `VARBINARY(max)` | The current active DEK, wrapped by the **Public Key**.             |

#### 1.2 `llm_rule_decision_audit` (The Encrypted Records)

We prepare the table for the "Envelope Encrypted" rows.

| Column              | Type             | Description                          |
|---------------------|------------------|--------------------------------------|
| `reason_ciphertext` | `VARBINARY(max)` | The encrypted PHI "reason".          |
| `reason_iv`         | `BINARY(12)`     | Random IV per row.                   |
| `reason_tag`        | `BINARY(16)`     | Auth Tag per row.                    |
| `basic_reason`      | `TEXT`           | Non-PHI summary for quick reference. |
| `is_encrypted`      | `BOOLEAN`        | Default `FALSE`.                     |

---

### Phase 2: The Cryptographic Service Logic

This service will be the "Engine" for your Knux application context.

1. **Key Generation:** When a clinic is provisioned, generate an RSA Key Pair.
2. **The "Seal" (Write Path):** To encrypt a reason:

* Fetch the `public_key`.
* Generate a random **Symmetric DEK**.
* Encrypt the reason with the **DEK** (AES-GCM).
* Encrypt (Wrap) the **DEK** using the **Public Key**.
* Save everything to the row.


3. **The "Open" (Read Path):** To decrypt:

* Admin provides the **Clinic Secret**.
* Decrypt the `encrypted_private_key` using that secret.
* Use the **Private Key** to unwrap the `tenant_dek_wrapped`.
* Use the raw **DEK** to decrypt the row's `reason_ciphertext`.

---

### Phase 3: The Admin Migration API

Since you'll have legacy plaintext data on dev, this API handles the transition.

* **Endpoint:** `POST /admin/provision-tenant`
* **Payload:** `{ site_config_id, clinic_secret }`
* **Logic:**

1. Generate RSA Key Pair.
2. Encrypt Private Key with `clinic_secret`.
3. Generate a Tenant DEK Wrap it with the Public Key.
4. **Batch Update:** Loop through all existing audit rows, encrypt the `reason`, and save to the new columns.
5. **Clean up:** Nullify the original plaintext `reason` column.

---

### Phase 4: Application Context Integration

Update your Knux/Nuxt `appContext` to handle the "Unlocked" state.

* **Middleware:** If a `clinic_secret` session exists, the `appContext` should hold the **unwrapped Private Key** in
  memory.
* **Decryption Getter:** When the UI requests an audit log, the service checks if the context is "Unlocked." If so, it
  decrypts the `reason_ciphertext` on-the-fly before sending it to the frontend.

---

### Phase 5: UI Changes

1. **Admin Vault:** A temporary page where you enter the secrets for existing clinics to trigger the Phase 3 migration.
2. **Unlock Prompt:** A "Lock/Unlock" icon on the Audit Dashboard. Clicking it prompts the user for their secret. Once
   entered, the reasons become readable.

### Summary of Benefits

* **Zero-Knowledge:** You cannot read their data even if you wanted to.
* **Write-Always:** Your LLM background tasks can save encrypted data 24/7 using the Public Key.
* **Clean Database:** One single migration makes the schema easy to maintain.

**Would you like me to provide the specific SQL DDL for this combined migration so you can run it on your dev
environment?**