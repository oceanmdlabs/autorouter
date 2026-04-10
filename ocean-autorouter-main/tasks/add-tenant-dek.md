This holistic implementation plan breaks down the transition from plaintext to a multi-tenant, Zero-Knowledge-ready
architecture. By following these phases, you ensure that the system is technically prepared before any data is
transformed, and that the "Admin Bridge" exists to handle legacy data safely.

---

# Implementation Plan: Zero-Knowledge PHI Encryption

## Phase 1: Data Model Updates (The Foundation)

In this phase, we prepare the database to store encrypted payloads and the "wrapped" key hierarchy.

### 1.1 `site_config` Table Extensions

Add columns to store the **Wrapped Tenant DEK**.

* `tenant_dek_wrapped` (VARBINARY/BLOB): The Data Encryption Key, encrypted by the Clinic Secret.
* `key_salt` (BINARY(16)): Random salt for the KDF (Key Derivation Function).
* `key_iv` (BINARY(12)): Initialization Vector for the DEK wrapping.
* `key_tag` (BINARY(16)): AES-GCM authentication tag for the wrapped DEK.
* `is_encrypted_setup` (BOOLEAN): Defaults to `FALSE`.

### 1.2 `llm_rule_decision_audit` Table Extensions

Prepare the table for row-level encryption.

* `reason_ciphertext` (TEXT/BLOB): The encrypted PHI.
* `reason_iv` (BINARY(12)): Unique IV per row.
* `reason_tag` (BINARY(16)): Unique Auth Tag per row.
* `basic_reason` (TEXT): A non-PHI summary for quick reference.
* `reason_encrypted` (BOOLEAN): Defaults to `FALSE`.

---

## Phase 2: Cryptographic Service Development

Create a centralized, hardened service (or utility class) to handle all math and encryption logic. **Do not store keys
in this service; it should only process them in memory.**

* **KDF Function:** Implements **Argon2id** or **PBKDF2-SHA256**. It takes a `clinic_secret` + `salt` and outputs a *
  *Key Encryption Key (KEK)**.
* **Wrapping Function:** Uses the **KEK** to encrypt/decrypt the **Tenant DEK** using AES-GCM.
* **Data Encryption Function:** Uses a raw **Tenant DEK** to encrypt/decrypt individual `reason` strings.
* **Zeroing Logic:** Ensure the service explicitly clears sensitive buffers from memory after use.

---

## Phase 3: Admin Provisioning API & Legacy Migration

This is the "Deliberate Bridge" API you will use to transition existing clinics.

### 3.1 The API (`POST /admin/provision-tenant`)

* **Inputs:** `site_config_id`, `clinic_secret` (provided manually by you).
* **Logic:**

1. Generate a fresh 256-bit **Tenant DEK**.
2. Use the `clinic_secret` to wrap the **Tenant DEK** (using the Crypto Service from Phase 2).
3. Save the wrapped key material to `site_config`.
4. **Migration Loop:** Find all rows in `llm_rule_decision_audit` for this clinic where `reason_encrypted = FALSE`.
5. For each row: Encrypt `reason` -> `reason_ciphertext`, generate `basic_reason`, and set `reason_encrypted = TRUE`.
6. Set `site_config.is_encrypted_setup = TRUE`.

### 3.2 Admin UI

* A simple, temporary dashboard listing clinics where `is_encrypted_setup = FALSE`.
* An input field for the `clinic_secret` and an "Execute Migration" button.

---

## Phase 4: Session "Unlock" & Context Integration

UI: Create a "Vault Unlock" input in the Clinic Admin settings.

This is to support when a clinic admin enters their **Clinic Secret** to unlock the DEK for their session.
We want to ensure that the records are then returned decrypted for their session.

So we want to accept the client secret, unwrap the DEK, and store it in the session for the duration of their login.
We also want to be able to clear the DEK from the session on logout and by action of the user. So support to set and
clear the DEK in session.
via API is required.

Server: Create an endpoint to receive the secret, unwrap the DEK, and store it in the Server-Side Session.

* **API Endpoint:** `POST /clinic/unlock-dek`
    * **Inputs:** `clinic_secret`
    * **Logic:**
        1. Fetch the `wrapped_dek`, `key_salt`, `key_iv`, and `key_tag` from `site_config`.
        2. Derive the KEK using the provided `clinic_secret` and `key_salt`.
        3. Unwrap the DEK using the KEK.
        4. Store the unwrapped DEK in the user's session context.
* **Security:** Ensure the DEK is cleared from the session on logout or explicit user action.
* API Endpoint: `POST /clinic/lock-dek`
    * **Logic:** Clear the DEK from the user's session context.

---

## Phase 5: Application Logic Update (New Data)

Update the standard "Save" path so that new incoming data is encrypted immediately.

* **The Write Path:** When the LLM generates a "reason," the app must:

1. Fetch the `wrapped_dek` for that clinic.
2. If it does not exist or `is_encrypted_setup = FALSE`, raise an error in the logs and don't store the reason or
   encrypted reason.
   we can still store the event just not the reason. So auditing will be intact, just without a detailed reason.
2. **Required:** The user's current session must have the `clinic_secret` available (or it must be provided) to unwrap
   the DEK.
3. Encrypt the new `reason` immediately.
4. Store only the ciphertext and metadata. **Block any code from saving to the old plaintext `reason` column.**
5. Update the UI to show only the `basic_reason` and a indication that the full reason is encrypted. reason: "Full
   reason is encrypted for security. Provide your Clinic Secret to view."

---

## Phase 6: Registration & Tenant Onboarding

Update the "New Clinic" flow to incorporate security from day one.

### 6.1 Registration UI

* In order to create a new clinic, the Clinic Admin must provide a **Clinic Secret**. Make it mandatory to hit the 'save'
button on the site-configuration page -> this triggers an instance of a new site.
* **Warning UI:** Clearly state that if they lose this secret, the data is unrecoverable (Zero-Knowledge).
* On the API side throw an exception if no `clinic_secret` is provided during registration.


### 6.2 Registration Backend

* The registration API receives the `clinic_secret`.
* It immediately triggers the logic from **Phase 3.1** (Generating the DEK and wrapping it). No data migration is needed
  since it's a new clinic.

---

## Summary of Data Flow

| Action               | Handled By             | Secret Location                    |
|----------------------|------------------------|------------------------------------|
| **Migrating Legacy** | Admin API (Phase 3)    | Manually entered by Admin          |
| **New Clinic Setup** | Registration (Phase 5) | Entered by Clinic Admin            |
| **Daily Operations** | App Logic (Phase 4)    | Provided via Admin Session/Keyring |

Would you like me to generate the specific **SQL migration scripts** for Phase 1 to get your database ready?