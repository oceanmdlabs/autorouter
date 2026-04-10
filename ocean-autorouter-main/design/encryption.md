# Encryption Acronyms and How Encryption Works in This App

## Acronyms and Definitions

### DEK (Data Encryption Key)

A key that encrypts and decrypts the actual sensitive application data (the plaintext), producing ciphertext.  
In this app: the per-tenant (per clinic/account) key used to encrypt/decrypt the `reason` value is a DEK.

### KEK (Key Encryption Key)

A key used to encrypt (wrap) other keys, not application data.  
In this app: the environment master key is a KEK because it encrypts (wraps) tenant DEKs before storing them.

### MASTER_KEK (Master Key Encryption Key)

The top-level KEK in the key hierarchy.  
In this MVP: stored in an environment variable.  
Later: replaced by a cloud KMS-managed key, while keeping the same data model.

### KMS (Key Management Service)

A managed cloud service for keys (AWS KMS, GCP Cloud KMS, Azure Key Vault).  
It can wrap/unwrap keys without exposing the master key to your app, and provides audit logs.

### HSM (Hardware Security Module)

Tamper-resistant hardware that protects cryptographic keys and performs cryptographic operations.  
Many KMS offerings use HSMs under the hood.

### IV (Initialization Vector) / Nonce

A per-encryption random value required by encryption modes like AES-GCM.  
For AES-GCM it is typically 12 bytes.  
Rule: IV must be unique per encryption under the same key. It is not secret and is stored with ciphertext.

### AAD (Additional Authenticated Data)

Data that is not encrypted but is cryptographically bound to the ciphertext.  
If AAD is altered or does not match at decrypt time, decryption fails.  
In this app: include tenantId and field identity to prevent cross-tenant ciphertext swapping.

### GCM (Galois/Counter Mode)

An authenticated encryption mode for AES that provides confidentiality and integrity.  
Used as AES-256-GCM (AES with a 256-bit key in GCM mode).

### Tag (Authentication Tag)

The integrity output produced by AES-GCM.  
It ensures ciphertext and AAD were not modified.  
Many libraries append the tag to the ciphertext bytes automatically.

### Ciphertext

The encrypted bytes you store in the database.

### Plaintext

The original unencrypted data you are protecting (the `reason` contents before encryption).

### Envelope Encryption

A standard pattern:

- Encrypt data with a DEK.
- Encrypt (wrap) the DEK with a KEK.
- Store ciphertext + wrapped DEK.
- Unwrap the DEK only when needed.

### Key Wrapping

Encrypting a key (like a DEK) using a KEK so it can be stored safely.

### Key Rotation

Replacing keys periodically or after compromise while keeping the ability to decrypt existing data.

### Key Versioning

Storing metadata indicating which key version encrypted a payload, so data remains decryptable after rotations.

### Blast Radius

The scope of impact if a key is compromised.  
If a single MASTER_KEK leaks, it can expose all wrapped tenant keys unless you move to KMS and tighten access.

# Updated Encryption Strategy: Zero-Knowledge Ready (Clinic Secret Model)

This document outlines the architecture for data encryption within the application. We have moved from a server-managed
model to a **Zero-Knowledge Ready** model using **Clinic Secrets**. This ensures that even with database access, an
administrator cannot decrypt sensitive PHI without the specific secret belonging to that clinic.

---

## 1. Updated Definitions & Acronyms

### Clinic Secret (Passphrase)

The "Master Key" owned by the clinic. It is a high-entropy passphrase or random string that is **not** stored in
plaintext on our servers. It is used to derive a wrapping key.

### KDF (Key Derivation Function)

A process (like PBKDF2 or Argon2) that turns a text-based *Clinic Secret* into a high-quality cryptographic key. This
includes a **Salt** to prevent pre-computation attacks.

### Tenant DEK (Data Encryption Key)

The 256-bit key that encrypts the actual `reason` column. Every clinic has its own unique DEK.

### Wrapped DEK

The Tenant DEK after it has been encrypted by the key derived from the Clinic Secret. This is what we store in the
database.

---

## 2. The Zero-Knowledge Key Hierarchy

Our architecture uses a three-tier approach to ensure data isolation and privacy:

1. **Tier 1 (The Human Layer):** The **Clinic Secret**. Provided by the user/admin and held only in transient memory.
2. **Tier 2 (The Wrapping Layer):** The **Key Encryption Key (KEK)**. Derived from the Clinic Secret + Salt. Used only
   to wrap/unwrap the DEK.
3. **Tier 3 (The Data Layer):** The **Tenant DEK**. Used to encrypt and decrypt the application data (`reason` field).

---

## 3. How Encryption Works End-to-End

### A) Clinic Onboarding (Key Provisioning)

When a new clinic is registered or migrated:

1. **Generate Secret:** A unique **Clinic Secret** is generated (or provided by the admin).
2. **Generate DEK:** A random 256-bit **Tenant DEK** is generated.
3. **Derive & Wrap:**

* A random **Salt** is generated.
* A wrapping key is derived from the *Clinic Secret* + *Salt*.
* The *Tenant DEK* is encrypted (wrapped) using **AES-256-GCM**.


4. **Store:** Save the `wrapped_dek`, `iv`, `salt`, and `alg` to the `site_config` table.
5. **Handoff:** The **Clinic Secret** and **Raw DEK** are provided to the clinic/admin as a "Recovery Sheet," then
   cleared from server memory.

### B) Writing Encrypted Data

When the app writes to the `llm_rule_decision_audit` table:

1. The app retrieves the **Clinic Secret** (from the active session or secure vault).
2. The **Tenant DEK** is unwrapped in memory using the Secret.
3. The `reason` plaintext is encrypted using **AES-256-GCM** with the unwrapped DEK.
4. A fresh **12-byte IV** is generated for every row.
5. **AAD** is applied (e.g., `tenant_id:<ID>`) to prevent data-swapping attacks.

### C) Reading Encrypted Data

1. The user requests a record.
2. The system checks if the user's session has the authorized **Clinic Secret**.
3. The **Tenant DEK** is unwrapped.
4. The `reason_ciphertext` is decrypted using the DEK + `reason_iv` + AAD.
5. If the Secret is incorrect or missing, the data remains unreadable ciphertext.

---

## 4. Database Schema Requirements

### Site Configuration (`site_config`)

These columns store the "locked" key material for each tenant.

| Column               | Purpose                                     |
|----------------------|---------------------------------------------|
| `tenant_dek_wrapped` | The DEK encrypted by the Secret.            |
| `tenant_dek_iv`      | The IV used to wrap the DEK.                |
| `key_salt`           | The random salt used for key derivation.    |
| `key_derivation_alg` | The algorithm used (e.g., `PBKDF2_SHA256`). |

### Audit Table (`llm_rule_decision_audit`)

These columns store the actual encrypted data.

| Column               | Purpose                              |
|----------------------|--------------------------------------|
| `reason_ciphertext`  | The encrypted PHI.                   |
| `reason_iv`          | Unique nonce per row.                |
| `reason_encrypted`   | Boolean flag for migration tracking. |
| `reason_key_version` | Tracks which DEK version was used.   |

---

## 5. Security & Liability Model (Why This Style?)

* **No Central Master Key:** There is no "Master Key" in an environment variable that can unlock all clinics. If the
  server is compromised, the attacker only gets "wrapped" keys which are useless without the individual Clinic Secrets.
* **Admin Privacy:** As the platform admin, you cannot see the data in the database because you do not have the Clinic
  Secrets in your session.
* **Portability:** By handing the "Recovery Sheet" (Secret + DEK) to the clinic, they have full ownership of their data.
  They can technically decrypt their own database exports even if your application is offline.

