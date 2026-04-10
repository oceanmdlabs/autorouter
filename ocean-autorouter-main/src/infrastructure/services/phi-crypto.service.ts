/**
 * PHI Cryptographic Service Implementation
 *
 * Implements Zero-Knowledge PHI encryption using:
 * - RSA-4096 for asymmetric key operations (key wrapping)
 * - PBKDF2-SHA256 for Key Derivation
 * - AES-256-GCM for authenticated symmetric encryption
 * - Secure buffer zeroing for memory safety
 *
 * Asymmetric Model Key Hierarchy:
 * 1. Clinic Secret (user-provided, never stored)
 * 2. RSA Key Pair (public plaintext, private encrypted by clinic secret)
 * 3. Row DEK (symmetric, wrapped by RSA public key per-row)
 * 4. Row-level ciphertext (PHI encrypted by row DEK)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2,
  createHash,
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
  constants as cryptoConstants
} from "crypto";
import { promisify } from "util";
import type {
  IPhiCryptoService,
  WrappedKeyMaterial,
  EncryptedData,
  GenerateDekResult,
  KeyPair,
  EncryptedPrivateKey,
  ProvisioningResult,
  SealedRowData
} from "@/src/application/services/phi-crypto.service.interface";
import { createLoggerFromEnv, type Logger } from "@/src/entities/models/logger";

const pbkdf2Async = promisify(pbkdf2);

// Constants for cryptographic operations
const ALGORITHM = "aes-256-gcm";
const DEK_SIZE = 32; // 256 bits
const SALT_SIZE = 16; // 128 bits
const IV_SIZE = 12; // 96 bits (recommended for GCM)
const TAG_SIZE = 16; // 128 bits

// PBKDF2 iterations - high count for security
// NIST recommends at least 10,000 iterations; we use 100,000 for added security
const KDF_ITERATIONS = 100_000;
const KDF_DIGEST = "sha256";

// RSA configuration for asymmetric encryption
// Using RSA-2048 to keep private key size under 2KB for cookie session storage
// RSA-2048 is still considered secure by NIST through 2030
const RSA_KEY_SIZE = 2048;
const RSA_PADDING = cryptoConstants.RSA_PKCS1_OAEP_PADDING;
const RSA_OAEP_HASH = "sha256";

type Dependencies = {};

export const createPhiCryptoService = (_deps: Dependencies = {}): IPhiCryptoService => {
  const logger: Logger = createLoggerFromEnv();

  /**
   * Derives a Key Encryption Key (KEK) from a clinic secret using PBKDF2-SHA256
   */
  async function deriveKek(clinicSecret: string, salt: Buffer): Promise<Buffer> {
    if (!clinicSecret || clinicSecret.length < 8) {
      throw new Error("Clinic secret must be at least 8 characters");
    }
    if (salt.length !== SALT_SIZE) {
      throw new Error(`Salt must be ${SALT_SIZE} bytes`);
    }

    const kek = await pbkdf2Async(
      clinicSecret,
      salt,
      KDF_ITERATIONS,
      DEK_SIZE,
      KDF_DIGEST
    );

    return kek as Buffer;
  }

  /**
   * Generates a new random Tenant DEK and wraps it with the provided clinic secret
   */
  async function generateAndWrapDek(clinicSecret: string): Promise<GenerateDekResult> {
    // Generate cryptographically secure random DEK
    const dek = randomBytes(DEK_SIZE);

    // Generate random salt for KDF
    const salt = randomBytes(SALT_SIZE);

    // Derive KEK from clinic secret
    const kek = await deriveKek(clinicSecret, salt);

    try {
      // Wrap the DEK with the KEK
      const { iv, wrapped, tag } = wrapDek(dek, kek);

      return {
        dek,
        wrappedMaterial: {
          wrappedDek: wrapped,
          salt,
          iv,
          tag
        }
      };
    } finally {
      // Zero the KEK immediately after use
      zeroBuffer(kek);
    }
  }

  /**
   * Wraps a DEK with a KEK using AES-256-GCM
   */
  function wrapDek(dek: Buffer, kek: Buffer): { iv: Buffer; wrapped: Buffer; tag: Buffer } {
    if (dek.length !== DEK_SIZE) {
      throw new Error(`DEK must be ${DEK_SIZE} bytes`);
    }
    if (kek.length !== DEK_SIZE) {
      throw new Error(`KEK must be ${DEK_SIZE} bytes`);
    }

    const iv = randomBytes(IV_SIZE);
    const cipher = createCipheriv(ALGORITHM, kek, iv);

    const wrapped = Buffer.concat([
      cipher.update(dek),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return { iv, wrapped, tag };
  }

  /**
   * Unwraps a DEK using the clinic secret
   */
  async function unwrapDek(
    clinicSecret: string,
    wrappedMaterial: WrappedKeyMaterial
  ): Promise<Buffer> {
    const { wrappedDek, salt, iv, tag } = wrappedMaterial;

    // Validate inputs
    if (salt.length !== SALT_SIZE) {
      throw new Error(`Invalid salt size: expected ${SALT_SIZE}, got ${salt.length}`);
    }
    if (iv.length !== IV_SIZE) {
      throw new Error(`Invalid IV size: expected ${IV_SIZE}, got ${iv.length}`);
    }
    if (tag.length !== TAG_SIZE) {
      throw new Error(`Invalid tag size: expected ${TAG_SIZE}, got ${tag.length}`);
    }

    // Derive KEK from clinic secret
    const kek = await deriveKek(clinicSecret, salt);

    try {
      const decipher = createDecipheriv(ALGORITHM, kek, iv);
      decipher.setAuthTag(tag);

      const dek = Buffer.concat([
        decipher.update(wrappedDek),
        decipher.final()
      ]);

      if (dek.length !== DEK_SIZE) {
        throw new Error("Unwrapped DEK has invalid size");
      }

      return dek;
    } catch (error) {
      logger.error("Failed to unwrap DEK - invalid clinic secret or corrupted data");
      throw new Error("Failed to unwrap DEK: authentication failed");
    } finally {
      // Zero the KEK immediately after use
      zeroBuffer(kek);
    }
  }

  /**
   * Encrypts PHI data using the Tenant DEK
   */
  function encryptPhi(plaintext: string, dek: Buffer): EncryptedData {
    if (dek.length !== DEK_SIZE) {
      throw new Error(`DEK must be ${DEK_SIZE} bytes`);
    }
    if (!plaintext) {
      throw new Error("Plaintext cannot be empty");
    }

    const iv = randomBytes(IV_SIZE);
    const cipher = createCipheriv(ALGORITHM, dek, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return { ciphertext, iv, tag };
  }

  /**
   * Decrypts PHI data using the Tenant DEK
   */
  function decryptPhi(encryptedData: EncryptedData, dek: Buffer): string {
    if (dek.length !== DEK_SIZE) {
      throw new Error(`DEK must be ${DEK_SIZE} bytes`);
    }

    const { ciphertext, iv, tag } = encryptedData;

    if (iv.length !== IV_SIZE) {
      throw new Error(`Invalid IV size: expected ${IV_SIZE}, got ${iv.length}`);
    }
    if (tag.length !== TAG_SIZE) {
      throw new Error(`Invalid tag size: expected ${TAG_SIZE}, got ${tag.length}`);
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, dek, iv);
      decipher.setAuthTag(tag);

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      return plaintext.toString("utf8");
    } catch (error) {
      logger.error("Failed to decrypt PHI - corrupted data or wrong key");
      throw new Error("Failed to decrypt PHI: authentication failed");
    }
  }

  /**
   * Generates a non-PHI summary from a reason string
   * Strips out potential PHI patterns and creates a generic summary
   */
  function generateBasicReason(reason: string): string {
    if (!reason || reason.trim() === "") {
      return "No reason provided";
    }

    // List of action keywords to look for
    const actionPatterns = [
      { pattern: /\b(accept|accepted|accepting)\b/i, action: "Acceptance" },
      { pattern: /\b(reject|rejected|rejecting|decline|declined)\b/i, action: "Rejection" },
      { pattern: /\b(forward|forwarded|forwarding|route|routed|routing)\b/i, action: "Routing" },
      { pattern: /\b(review|reviewed|reviewing)\b/i, action: "Review" },
      { pattern: /\b(schedule|scheduled|scheduling)\b/i, action: "Scheduling" },
      { pattern: /\b(message|messaged|notify|notified)\b/i, action: "Communication" },
      { pattern: /\b(priorit|urgent|emergenc)\b/i, action: "Priority assessment" },
      { pattern: /\b(complete|completed|completing)\b/i, action: "Completion" },
      { pattern: /\b(cancel|cancelled|canceling)\b/i, action: "Cancellation" },
      { pattern: /\b(update|updated|updating)\b/i, action: "Update" },
      { pattern: /\b(skip|skipped|skipping)\b/i, action: "Skip" },
      { pattern: /\b(error|failed|failure)\b/i, action: "Error" }
    ];

    // Find matching actions
    const matchedActions: string[] = [];
    for (const { pattern, action } of actionPatterns) {
      if (pattern.test(reason)) {
        matchedActions.push(action);
      }
    }

    if (matchedActions.length > 0) {
      // Return the first 2 actions found
      const actions = matchedActions.slice(0, 2).join(", ");
      return `LLM decision: ${actions}`;
    }

    // Generic fallback - just hash a portion to create a reference
    const hash = createHash("sha256").update(reason).digest("hex").substring(0, 8);
    return `LLM decision (ref: ${hash})`;
  }

  /**
   * Securely zeros a buffer to prevent memory leaks of sensitive data
   * Uses crypto.timingSafeEqual-compatible approach
   */
  function zeroBuffer(buffer: Buffer): void {
    if (!buffer || buffer.length === 0) {
      return;
    }

    // Fill with zeros
    buffer.fill(0);

    // Additional paranoid measure: overwrite with random then zero again
    // This helps against potential compiler optimizations that might skip the fill
    const random = randomBytes(buffer.length);
    random.copy(buffer);
    buffer.fill(0);
  }

  // ============================================
  // ASYMMETRIC ENCRYPTION METHODS
  // ============================================

  /**
   * Generates a new RSA-4096 key pair for a tenant
   */
  async function generateKeyPair(): Promise<KeyPair> {
    logger.info("Generating RSA-2048 key pair...");

    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: RSA_KEY_SIZE,
      publicKeyEncoding: {
        type: "spki",
        format: "pem"
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem"
      }
    });

    logger.info("RSA key pair generated successfully");
    return { publicKey, privateKey };
  }

  /**
   * Encrypts a private key with the clinic secret for secure storage
   */
  async function encryptPrivateKey(
    privateKey: string,
    clinicSecret: string
  ): Promise<EncryptedPrivateKey> {
    // Generate random salt for KDF
    const salt = randomBytes(SALT_SIZE);

    // Derive encryption key from clinic secret
    const encryptionKey = await deriveKek(clinicSecret, salt);

    try {
      // Encrypt the private key with AES-256-GCM
      const iv = randomBytes(IV_SIZE);
      const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

      const encryptedKey = Buffer.concat([
        cipher.update(privateKey, "utf8"),
        cipher.final()
      ]);

      const tag = cipher.getAuthTag();

      return {
        encryptedKey,
        iv,
        tag,
        salt
      };
    } finally {
      // Zero the encryption key immediately after use
      zeroBuffer(encryptionKey);
    }
  }

  /**
   * Decrypts a stored private key using the clinic secret
   */
  async function decryptPrivateKey(
    encryptedMaterial: EncryptedPrivateKey,
    clinicSecret: string
  ): Promise<string> {
    const { encryptedKey, iv, tag, salt } = encryptedMaterial;

    // Validate inputs
    if (salt.length !== SALT_SIZE) {
      throw new Error(`Invalid salt size: expected ${SALT_SIZE}, got ${salt.length}`);
    }
    if (iv.length !== IV_SIZE) {
      throw new Error(`Invalid IV size: expected ${IV_SIZE}, got ${iv.length}`);
    }
    if (tag.length !== TAG_SIZE) {
      throw new Error(`Invalid tag size: expected ${TAG_SIZE}, got ${tag.length}`);
    }

    // Derive decryption key from clinic secret
    const decryptionKey = await deriveKek(clinicSecret, salt);

    try {
      const decipher = createDecipheriv(ALGORITHM, decryptionKey, iv);
      decipher.setAuthTag(tag);

      const privateKey = Buffer.concat([
        decipher.update(encryptedKey),
        decipher.final()
      ]);

      return privateKey.toString("utf8");
    } catch (error) {
      logger.error("Failed to decrypt private key - invalid clinic secret or corrupted data");
      throw new Error("Failed to decrypt private key: authentication failed");
    } finally {
      // Zero the decryption key immediately after use
      zeroBuffer(decryptionKey);
    }
  }

  /**
   * Provisions a new tenant with asymmetric encryption
   */
  async function provisionTenant(clinicSecret: string): Promise<ProvisioningResult> {
    // Generate RSA key pair
    const keyPair = await generateKeyPair();

    // Encrypt private key with clinic secret
    const encryptedPrivateKey = await encryptPrivateKey(keyPair.privateKey, clinicSecret);

    // Zero the raw private key from memory
    // Note: JavaScript strings are immutable, so we can't truly zero them
    // The private key will be garbage collected eventually

    logger.info("Tenant encryption provisioned successfully");

    return {
      publicKey: keyPair.publicKey,
      encryptedPrivateKey
    };
  }

  /**
   * "Seal" - Encrypts PHI for storage using the public key (Write Path)
   * Uses envelope encryption: random DEK encrypted by RSA, PHI encrypted by DEK
   */
  function seal(plaintext: string, publicKey: string): SealedRowData {
    if (!plaintext) {
      throw new Error("Plaintext cannot be empty");
    }
    if (!publicKey) {
      throw new Error("Public key is required");
    }

    // Generate a random row DEK
    const rowDek = randomBytes(DEK_SIZE);

    try {
      // Encrypt the PHI with the row DEK (AES-256-GCM)
      const iv = randomBytes(IV_SIZE);
      const cipher = createCipheriv(ALGORITHM, rowDek, iv);

      const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
      ]);

      const tag = cipher.getAuthTag();

      // Wrap the row DEK with the RSA public key
      const wrappedDek = publicEncrypt(
        {
          key: publicKey,
          padding: RSA_PADDING,
          oaepHash: RSA_OAEP_HASH
        },
        rowDek
      );

      return {
        wrappedDek,
        ciphertext,
        iv,
        tag
      };
    } finally {
      // Zero the row DEK immediately after use
      zeroBuffer(rowDek);
    }
  }

  /**
   * "Open" - Decrypts stored PHI using the private key (Read Path)
   */
  function open(sealedData: SealedRowData, privateKey: string): string {
    if (!privateKey) {
      throw new Error("Private key is required");
    }

    const { wrappedDek, ciphertext, iv, tag } = sealedData;

    if (iv.length !== IV_SIZE) {
      throw new Error(`Invalid IV size: expected ${IV_SIZE}, got ${iv.length}`);
    }
    if (tag.length !== TAG_SIZE) {
      throw new Error(`Invalid tag size: expected ${TAG_SIZE}, got ${tag.length}`);
    }

    // Unwrap the row DEK with the RSA private key
    let rowDek: Buffer;
    try {
      rowDek = privateDecrypt(
        {
          key: privateKey,
          padding: RSA_PADDING,
          oaepHash: RSA_OAEP_HASH
        },
        wrappedDek
      );
    } catch (error) {
      logger.error("Failed to unwrap row DEK - invalid private key or corrupted data");
      throw new Error("Failed to unwrap row DEK: decryption failed");
    }

    try {
      if (rowDek.length !== DEK_SIZE) {
        throw new Error(`Unwrapped DEK has invalid size: expected ${DEK_SIZE}, got ${rowDek.length}`);
      }

      // Decrypt the PHI with the row DEK
      const decipher = createDecipheriv(ALGORITHM, rowDek, iv);
      decipher.setAuthTag(tag);

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      return plaintext.toString("utf8");
    } catch (error) {
      if ((error as Error).message.includes("unwrapped")) {
        throw error;
      }
      logger.error("Failed to decrypt PHI - corrupted data or wrong key");
      throw new Error("Failed to decrypt PHI: authentication failed");
    } finally {
      // Zero the row DEK immediately after use
      zeroBuffer(rowDek);
    }
  }

  return {
    // Asymmetric methods (new)
    generateKeyPair,
    encryptPrivateKey,
    decryptPrivateKey,
    provisionTenant,
    seal,
    open,
    // Symmetric methods (legacy/internal)
    deriveKek,
    generateAndWrapDek,
    wrapDek,
    unwrapDek,
    encryptPhi,
    decryptPhi,
    // Utility methods
    generateBasicReason,
    zeroBuffer
  };
};

