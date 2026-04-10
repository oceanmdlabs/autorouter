/**
 * PHI Cryptographic Service Interface
 *
 * Handles Zero-Knowledge PHI encryption using an Asymmetric (RSA) + Symmetric (AES) hybrid model:
 *
 * Key Hierarchy:
 * - Clinic Secret (user-provided, never stored)
 * - RSA Key Pair (public key stored plaintext, private key encrypted by clinic secret)
 * - Row DEK (symmetric key, encrypted/wrapped by RSA public key per-row)
 * - PHI Data (encrypted by row DEK using AES-GCM)
 *
 * Write Path ("Seal"):
 * 1. Fetch tenant's public key
 * 2. Generate random row DEK
 * 3. Encrypt PHI with row DEK (AES-GCM)
 * 4. Wrap row DEK with public key (RSA-OAEP)
 * 5. Store wrapped DEK + ciphertext
 *
 * Read Path ("Open"):
 * 1. User provides clinic secret
 * 2. Decrypt private key with clinic secret
 * 3. Unwrap row DEK with private key (RSA-OAEP)
 * 4. Decrypt PHI with row DEK (AES-GCM)
 */

/**
 * RSA Key Pair for asymmetric encryption
 */
export interface KeyPair {
  /** RSA Public Key in PEM format */
  publicKey: string;
  /** RSA Private Key in PEM format */
  privateKey: string;
}

/**
 * Encrypted private key material for storage
 */
export interface EncryptedPrivateKey {
  /** The encrypted private key */
  encryptedKey: Buffer;
  /** IV for the encryption (12 bytes for AES-GCM) */
  iv: Buffer;
  /** Authentication tag (16 bytes) */
  tag: Buffer;
  /** Salt used for KDF (16 bytes) */
  salt: Buffer;
}

/**
 * Result of provisioning a tenant with encryption
 */
export interface ProvisioningResult {
  /** The public key to store in plaintext */
  publicKey: string;
  /** The encrypted private key material to store */
  encryptedPrivateKey: EncryptedPrivateKey;
}

/**
 * Sealed (encrypted) data for a single row
 */
export interface SealedRowData {
  /** Row DEK wrapped by RSA public key */
  wrappedDek: Buffer;
  /** PHI ciphertext encrypted by row DEK */
  ciphertext: Buffer;
  /** IV for PHI encryption (12 bytes) */
  iv: Buffer;
  /** Auth tag for PHI encryption (16 bytes) */
  tag: Buffer;
}

// Legacy types for backward compatibility
export interface WrappedKeyMaterial {
  wrappedDek: Buffer;
  salt: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export interface GenerateDekResult {
  dek: Buffer;
  wrappedMaterial: WrappedKeyMaterial;
}

export interface IPhiCryptoService {
  // ============================================
  // ASYMMETRIC ENCRYPTION METHODS (New)
  // ============================================

  /**
   * Generates a new RSA-4096 key pair for a tenant
   * @returns The public and private keys in PEM format
   */
  generateKeyPair(): Promise<KeyPair>;

  /**
   * Encrypts a private key with the clinic secret for secure storage
   * @param privateKey - The RSA private key in PEM format
   * @param clinicSecret - The user-provided clinic secret
   * @returns Encrypted private key material for database storage
   */
  encryptPrivateKey(privateKey: string, clinicSecret: string): Promise<EncryptedPrivateKey>;

  /**
   * Decrypts a stored private key using the clinic secret
   * @param encryptedMaterial - The stored encrypted private key material
   * @param clinicSecret - The user-provided clinic secret
   * @returns The decrypted RSA private key in PEM format
   */
  decryptPrivateKey(encryptedMaterial: EncryptedPrivateKey, clinicSecret: string): Promise<string>;

  /**
   * Provisions a new tenant with asymmetric encryption
   * Generates key pair and encrypts private key with clinic secret
   * @param clinicSecret - The user-provided clinic secret
   * @returns Public key and encrypted private key material for storage
   */
  provisionTenant(clinicSecret: string): Promise<ProvisioningResult>;

  /**
   * "Seal" - Encrypts PHI for storage using the public key (Write Path)
   * 1. Generates a random row DEK
   * 2. Encrypts the PHI with the row DEK
   * 3. Wraps the row DEK with the RSA public key
   * @param plaintext - The PHI to encrypt
   * @param publicKey - The tenant's RSA public key (PEM format)
   * @returns Sealed data containing wrapped DEK and encrypted PHI
   */
  seal(plaintext: string, publicKey: string): SealedRowData;

  /**
   * "Open" - Decrypts stored PHI using the private key (Read Path)
   * 1. Unwraps the row DEK with the RSA private key
   * 2. Decrypts the PHI with the row DEK
   * @param sealedData - The stored sealed data
   * @param privateKey - The tenant's RSA private key (PEM format)
   * @returns The decrypted PHI plaintext
   */
  open(sealedData: SealedRowData, privateKey: string): string;

  // ============================================
  // SYMMETRIC ENCRYPTION METHODS (Legacy/Internal)
  // ============================================

  /**
   * Derives a Key Encryption Key (KEK) from a clinic secret using PBKDF2
   * @param clinicSecret - The user-provided clinic secret
   * @param salt - Random salt (16 bytes)
   * @returns The derived KEK (32 bytes for AES-256)
   */
  deriveKek(clinicSecret: string, salt: Buffer): Promise<Buffer>;

  /**
   * Generates a new random Tenant DEK and wraps it with the provided clinic secret
   * @deprecated Use provisionTenant() for asymmetric model
   */
  generateAndWrapDek(clinicSecret: string): Promise<GenerateDekResult>;

  /**
   * Wraps an existing DEK with a KEK using AES-256-GCM
   */
  wrapDek(dek: Buffer, kek: Buffer): { iv: Buffer; wrapped: Buffer; tag: Buffer };

  /**
   * Unwraps a DEK using the clinic secret
   * @deprecated Use decryptPrivateKey() + open() for asymmetric model
   */
  unwrapDek(clinicSecret: string, wrappedMaterial: WrappedKeyMaterial): Promise<Buffer>;

  /**
   * Encrypts PHI data using a symmetric DEK
   */
  encryptPhi(plaintext: string, dek: Buffer): EncryptedData;

  /**
   * Decrypts PHI data using a symmetric DEK
   */
  decryptPhi(encryptedData: EncryptedData, dek: Buffer): string;

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generates a non-PHI summary from a reason string
   * @param reason - The full reason text
   * @returns A sanitized, non-PHI summary
   */
  generateBasicReason(reason: string): string;

  /**
   * Securely zeros a buffer to prevent memory leaks
   * @param buffer - The buffer to zero
   */
  zeroBuffer(buffer: Buffer): void;
}

