import { describe, it, expect, beforeEach } from "vitest";
import { createPhiCryptoService } from "../phi-crypto.service";
import type { IPhiCryptoService, WrappedKeyMaterial } from "@/src/application/services/phi-crypto.service.interface";
import { randomBytes } from "crypto";

describe("PhiCryptoService", () => {
  let service: IPhiCryptoService;

  beforeEach(() => {
    service = createPhiCryptoService();
  });

  describe("deriveKek", () => {
    it("should derive a 32-byte KEK from clinic secret and salt", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const salt = randomBytes(16);

      const kek = await service.deriveKek(clinicSecret, salt);

      expect(kek).toBeInstanceOf(Buffer);
      expect(kek.length).toBe(32);
    });

    it("should derive the same KEK for the same secret and salt", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const salt = randomBytes(16);

      const kek1 = await service.deriveKek(clinicSecret, salt);
      const kek2 = await service.deriveKek(clinicSecret, salt);

      expect(kek1.equals(kek2)).toBe(true);
    });

    it("should derive different KEKs for different salts", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const salt1 = randomBytes(16);
      const salt2 = randomBytes(16);

      const kek1 = await service.deriveKek(clinicSecret, salt1);
      const kek2 = await service.deriveKek(clinicSecret, salt2);

      expect(kek1.equals(kek2)).toBe(false);
    });

    it("should throw error for short clinic secret", async () => {
      const shortSecret = "short";
      const salt = randomBytes(16);

      await expect(service.deriveKek(shortSecret, salt)).rejects.toThrow(
        "Clinic secret must be at least 8 characters"
      );
    });

    it("should throw error for invalid salt size", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const wrongSalt = randomBytes(8); // Should be 16

      await expect(service.deriveKek(clinicSecret, wrongSalt)).rejects.toThrow(
        "Salt must be 16 bytes"
      );
    });
  });

  describe("generateAndWrapDek", () => {
    it("should generate a DEK and wrapped material", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";

      const result = await service.generateAndWrapDek(clinicSecret);

      expect(result.dek).toBeInstanceOf(Buffer);
      expect(result.dek.length).toBe(32);
      expect(result.wrappedMaterial.wrappedDek).toBeInstanceOf(Buffer);
      expect(result.wrappedMaterial.salt).toBeInstanceOf(Buffer);
      expect(result.wrappedMaterial.salt.length).toBe(16);
      expect(result.wrappedMaterial.iv).toBeInstanceOf(Buffer);
      expect(result.wrappedMaterial.iv.length).toBe(12);
      expect(result.wrappedMaterial.tag).toBeInstanceOf(Buffer);
      expect(result.wrappedMaterial.tag.length).toBe(16);
    });

    it("should generate different DEKs each time", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";

      const result1 = await service.generateAndWrapDek(clinicSecret);
      const result2 = await service.generateAndWrapDek(clinicSecret);

      expect(result1.dek.equals(result2.dek)).toBe(false);
    });
  });

  describe("wrapDek / unwrapDek", () => {
    it("should wrap and unwrap a DEK correctly", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";

      // Generate and wrap
      const { dek: originalDek, wrappedMaterial } = await service.generateAndWrapDek(clinicSecret);

      // Unwrap
      const unwrappedDek = await service.unwrapDek(clinicSecret, wrappedMaterial);

      expect(unwrappedDek.equals(originalDek)).toBe(true);
    });

    it("should fail to unwrap with wrong clinic secret", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const wrongSecret = "wrong-clinic-secret-456";

      const { wrappedMaterial } = await service.generateAndWrapDek(clinicSecret);

      await expect(service.unwrapDek(wrongSecret, wrappedMaterial)).rejects.toThrow(
        "Failed to unwrap DEK: authentication failed"
      );
    });

    it("should fail with tampered wrapped DEK", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";

      const { wrappedMaterial } = await service.generateAndWrapDek(clinicSecret);

      // Tamper with the wrapped DEK
      const tamperedMaterial: WrappedKeyMaterial = {
        ...wrappedMaterial,
        wrappedDek: Buffer.from(wrappedMaterial.wrappedDek.map(b => b ^ 0xFF))
      };

      await expect(service.unwrapDek(clinicSecret, tamperedMaterial)).rejects.toThrow(
        "Failed to unwrap DEK: authentication failed"
      );
    });
  });

  describe("encryptPhi / decryptPhi", () => {
    it("should encrypt and decrypt PHI correctly", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const { dek } = await service.generateAndWrapDek(clinicSecret);

      const plaintext = "Patient John Doe has chronic back pain and requires surgery.";

      const encrypted = service.encryptPhi(plaintext, dek);
      const decrypted = service.decryptPhi(encrypted, dek);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext (unique IVs)", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const { dek } = await service.generateAndWrapDek(clinicSecret);

      const plaintext = "Patient PHI data";

      const encrypted1 = service.encryptPhi(plaintext, dek);
      const encrypted2 = service.encryptPhi(plaintext, dek);

      // IVs should be different
      expect(encrypted1.iv.equals(encrypted2.iv)).toBe(false);
      // Ciphertext should be different
      expect(encrypted1.ciphertext.equals(encrypted2.ciphertext)).toBe(false);
    });

    it("should fail decryption with wrong DEK", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const { dek: dek1 } = await service.generateAndWrapDek(clinicSecret);
      const { dek: dek2 } = await service.generateAndWrapDek(clinicSecret);

      const plaintext = "Patient PHI data";
      const encrypted = service.encryptPhi(plaintext, dek1);

      expect(() => service.decryptPhi(encrypted, dek2)).toThrow(
        "Failed to decrypt PHI: authentication failed"
      );
    });

    it("should fail decryption with tampered ciphertext", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const { dek } = await service.generateAndWrapDek(clinicSecret);

      const plaintext = "Patient PHI data";
      const encrypted = service.encryptPhi(plaintext, dek);

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: Buffer.from(encrypted.ciphertext.map(b => b ^ 0xFF))
      };

      expect(() => service.decryptPhi(tampered, dek)).toThrow(
        "Failed to decrypt PHI: authentication failed"
      );
    });

    it("should handle unicode and special characters", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const { dek } = await service.generateAndWrapDek(clinicSecret);

      const plaintext = "Patient 日本語 émojis 🏥💊 special chars: <>&\"'";

      const encrypted = service.encryptPhi(plaintext, dek);
      const decrypted = service.decryptPhi(encrypted, dek);

      expect(decrypted).toBe(plaintext);
    });

    it("should throw error for empty plaintext", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const { dek } = await service.generateAndWrapDek(clinicSecret);

      expect(() => service.encryptPhi("", dek)).toThrow("Plaintext cannot be empty");
    });
  });

  describe("generateBasicReason", () => {
    it("should generate basic reason for acceptance", () => {
      const reason = "Accepting this referral because the patient meets criteria.";
      const basic = service.generateBasicReason(reason);
      expect(basic).toBe("LLM decision: Acceptance");
    });

    it("should generate basic reason for rejection", () => {
      const reason = "Rejecting due to incomplete information.";
      const basic = service.generateBasicReason(reason);
      expect(basic).toBe("LLM decision: Rejection");
    });

    it("should generate basic reason for routing", () => {
      const reason = "Forwarding to cardiology department.";
      const basic = service.generateBasicReason(reason);
      expect(basic).toBe("LLM decision: Routing");
    });

    it("should handle multiple actions", () => {
      const reason = "Reviewed the case and scheduled an appointment.";
      const basic = service.generateBasicReason(reason);
      expect(basic).toBe("LLM decision: Review, Scheduling");
    });

    it("should return generic reason with hash for unknown patterns", () => {
      const reason = "Some very specific technical output that doesn't match patterns.";
      const basic = service.generateBasicReason(reason);
      expect(basic).toMatch(/^LLM decision \(ref: [a-f0-9]{8}\)$/);
    });

    it("should handle empty or null reason", () => {
      expect(service.generateBasicReason("")).toBe("No reason provided");
      expect(service.generateBasicReason("   ")).toBe("No reason provided");
    });
  });

  describe("zeroBuffer", () => {
    it("should zero a buffer", () => {
      const buffer = Buffer.from("sensitive data here");
      service.zeroBuffer(buffer);

      // All bytes should be zero
      expect(buffer.every(b => b === 0)).toBe(true);
    });

    it("should handle empty buffer without error", () => {
      const buffer = Buffer.alloc(0);
      expect(() => service.zeroBuffer(buffer)).not.toThrow();
    });
  });

  describe("end-to-end encryption flow", () => {
    it("should support full encryption flow: generate DEK, wrap, store, unwrap, encrypt PHI", async () => {
      const clinicSecret = "super-secret-clinic-password-2024!";

      // Step 1: Generate and wrap DEK (during tenant provisioning)
      const { dek, wrappedMaterial } = await service.generateAndWrapDek(clinicSecret);

      // Simulate storing wrapped material (would go to database)
      const storedMaterial = {
        wrappedDek: wrappedMaterial.wrappedDek,
        salt: wrappedMaterial.salt,
        iv: wrappedMaterial.iv,
        tag: wrappedMaterial.tag
      };

      // Zero the original DEK (we only keep wrapped version)
      const originalDekCopy = Buffer.from(dek);
      service.zeroBuffer(dek);

      // Step 2: Later, unwrap DEK using clinic secret (during session)
      const unwrappedDek = await service.unwrapDek(clinicSecret, storedMaterial);
      expect(unwrappedDek.equals(originalDekCopy)).toBe(true);

      // Step 3: Encrypt PHI
      const phi = "Patient Jane Smith (DOB: 1985-03-15) presents with severe migraine.";
      const encrypted = service.encryptPhi(phi, unwrappedDek);

      // Generate non-PHI summary
      const basicReason = service.generateBasicReason(phi);

      // Step 4: Store encrypted data (would go to database)
      const storedRecord = {
        reasonCiphertext: encrypted.ciphertext,
        reasonIv: encrypted.iv,
        reasonTag: encrypted.tag,
        basicReason,
        reasonEncrypted: true
      };

      // Step 5: Later, decrypt PHI
      const decrypted = service.decryptPhi({
        ciphertext: storedRecord.reasonCiphertext,
        iv: storedRecord.reasonIv,
        tag: storedRecord.reasonTag
      }, unwrappedDek);

      expect(decrypted).toBe(phi);

      // Clean up
      service.zeroBuffer(unwrappedDek);
    });
  });

  // ============================================
  // ASYMMETRIC ENCRYPTION TESTS
  // ============================================

  describe("generateKeyPair", () => {
    it("should generate valid RSA key pair in PEM format", async () => {
      const keyPair = await service.generateKeyPair();

      expect(keyPair.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
      expect(keyPair.publicKey).toContain("-----END PUBLIC KEY-----");
      expect(keyPair.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
      expect(keyPair.privateKey).toContain("-----END PRIVATE KEY-----");
    });
  });

  describe("encryptPrivateKey / decryptPrivateKey", () => {
    it("should encrypt and decrypt private key correctly", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const keyPair = await service.generateKeyPair();

      const encrypted = await service.encryptPrivateKey(keyPair.privateKey, clinicSecret);

      expect(encrypted.encryptedKey).toBeInstanceOf(Buffer);
      expect(encrypted.encryptedKey.length).toBeGreaterThan(0);
      expect(encrypted.iv.length).toBe(12);
      expect(encrypted.tag.length).toBe(16);
      expect(encrypted.salt.length).toBe(16);

      const decrypted = await service.decryptPrivateKey(encrypted, clinicSecret);
      expect(decrypted).toBe(keyPair.privateKey);
    });

    it("should fail to decrypt with wrong clinic secret", async () => {
      const clinicSecret = "correct-secret-123";
      const wrongSecret = "wrong-secret-456";
      const keyPair = await service.generateKeyPair();

      const encrypted = await service.encryptPrivateKey(keyPair.privateKey, clinicSecret);

      await expect(
        service.decryptPrivateKey(encrypted, wrongSecret)
      ).rejects.toThrow("authentication failed");
    });
  });

  describe("provisionTenant", () => {
    it("should provision tenant with public key and encrypted private key", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";

      const result = await service.provisionTenant(clinicSecret);

      expect(result.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
      expect(result.encryptedPrivateKey.encryptedKey).toBeInstanceOf(Buffer);
      expect(result.encryptedPrivateKey.salt.length).toBe(16);
      expect(result.encryptedPrivateKey.iv.length).toBe(12);
      expect(result.encryptedPrivateKey.tag.length).toBe(16);
    });
  });

  describe("seal / open", () => {
    it("should seal and open PHI correctly", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const phi = "Patient John Doe (DOB: 1980-05-20) has diabetes.";

      // Provision tenant
      const provisioning = await service.provisionTenant(clinicSecret);

      // Seal (encrypt) PHI - can be done without clinic secret
      const sealed = service.seal(phi, provisioning.publicKey);

      expect(sealed.wrappedDek).toBeInstanceOf(Buffer);
      expect(sealed.wrappedDek.length).toBe(256); // RSA-2048 produces 256-byte output
      expect(sealed.ciphertext).toBeInstanceOf(Buffer);
      expect(sealed.iv.length).toBe(12);
      expect(sealed.tag.length).toBe(16);

      // Decrypt private key (requires clinic secret)
      const privateKey = await service.decryptPrivateKey(
        provisioning.encryptedPrivateKey,
        clinicSecret
      );

      // Open (decrypt) PHI
      const opened = service.open(sealed, privateKey);

      expect(opened).toBe(phi);
    });

    it("should produce different sealed data for same plaintext", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const phi = "Same message twice";

      const provisioning = await service.provisionTenant(clinicSecret);

      const sealed1 = service.seal(phi, provisioning.publicKey);
      const sealed2 = service.seal(phi, provisioning.publicKey);

      // Different IVs means different ciphertext
      expect(sealed1.iv.equals(sealed2.iv)).toBe(false);
      expect(sealed1.ciphertext.equals(sealed2.ciphertext)).toBe(false);
      // Wrapped DEKs should also be different (different random DEKs)
      expect(sealed1.wrappedDek.equals(sealed2.wrappedDek)).toBe(false);
    });

    it("should fail to open with wrong private key", async () => {
      const clinicSecret1 = "clinic-secret-one";
      const clinicSecret2 = "clinic-secret-two";
      const phi = "Secret patient data";

      const provisioning1 = await service.provisionTenant(clinicSecret1);
      const provisioning2 = await service.provisionTenant(clinicSecret2);

      // Seal with tenant 1's public key
      const sealed = service.seal(phi, provisioning1.publicKey);

      // Try to open with tenant 2's private key
      const wrongPrivateKey = await service.decryptPrivateKey(
        provisioning2.encryptedPrivateKey,
        clinicSecret2
      );

      expect(() => service.open(sealed, wrongPrivateKey)).toThrow("decryption failed");
    });

    it("should throw error for empty plaintext", async () => {
      const provisioning = await service.provisionTenant("clinic-secret-123");

      expect(() => service.seal("", provisioning.publicKey)).toThrow("Plaintext cannot be empty");
    });

    it("should handle unicode and special characters", async () => {
      const clinicSecret = "my-secure-clinic-secret-123";
      const phi = "Patient 日本語 🏥 with special chars: <>&\"'";

      const provisioning = await service.provisionTenant(clinicSecret);
      const sealed = service.seal(phi, provisioning.publicKey);

      const privateKey = await service.decryptPrivateKey(
        provisioning.encryptedPrivateKey,
        clinicSecret
      );

      const opened = service.open(sealed, privateKey);
      expect(opened).toBe(phi);
    });
  });

  describe("asymmetric end-to-end flow", () => {
    it("should support full asymmetric encryption flow", async () => {
      const clinicSecret = "super-secure-clinic-secret-2024";

      // Step 1: Admin provisions tenant (one-time setup)
      const provisioning = await service.provisionTenant(clinicSecret);

      // Store in database:
      // - provisioning.publicKey (plaintext)
      // - provisioning.encryptedPrivateKey.encryptedKey
      // - provisioning.encryptedPrivateKey.iv
      // - provisioning.encryptedPrivateKey.tag
      // - provisioning.encryptedPrivateKey.salt

      // Step 2: LLM generates decision with PHI (background process)
      const phi = "Patient Jane Smith requires urgent cardiac evaluation based on ECG abnormalities.";
      const basicReason = service.generateBasicReason(phi);

      // Seal the PHI - only needs public key (no clinic secret needed!)
      const sealed = service.seal(phi, provisioning.publicKey);

      // Store in audit record:
      // - sealed.wrappedDek (row_dek_wrapped)
      // - sealed.ciphertext (reason_ciphertext)
      // - sealed.iv (reason_iv)
      // - sealed.tag (reason_tag)
      // - basicReason (basic_reason)
      // - reasonEncrypted: true

      // Step 3: User enters clinic secret to view PHI
      const privateKey = await service.decryptPrivateKey(
        provisioning.encryptedPrivateKey,
        clinicSecret
      );

      // Step 4: Decrypt PHI for display
      const decryptedPhi = service.open(sealed, privateKey);

      expect(decryptedPhi).toBe(phi);
      expect(basicReason).not.toContain("Jane Smith");
      expect(basicReason).toContain("LLM decision");
    });
  });
});

