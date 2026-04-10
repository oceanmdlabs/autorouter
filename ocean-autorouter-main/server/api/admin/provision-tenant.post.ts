/**
 * Admin Provisioning API for Zero-Knowledge PHI Encryption (Asymmetric Model)
 *
 * POST /api/admin/provision-tenant
 *
 * This endpoint:
 * 1. Generates an RSA key pair
 * 2. Encrypts the private key with the clinic_secret (AES-GCM)
 * 3. Stores public key and encrypted private key in site_config
 * 4. Migrates all existing unencrypted audit records using envelope encryption
 * 5. Nullifies original plaintext reason column
 * 6. Sets is_encrypted_setup = TRUE
 */

import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { z } from "zod";

const provisionTenantSchema = z.object({
  siteConfigId: z.string().uuid("Invalid site config ID"),
  clinicSecret: z.string().min(12, "Clinic secret must be at least 12 characters")
    .max(128, "Clinic secret must be at most 128 characters")
});

export interface ProvisionTenantResponse {
  success: boolean;
  siteId: string;
  message: string;
  recordsMigrated: number;
  recordsRemaining: number;
}

export default defineEventHandler(async (event): Promise<ProvisionTenantResponse> => {
  const cxt = await toApplicationContext(event);

  // Require system admin role
  if (cxt.getUser()?.roles?.admin !== "system") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only system administrators can provision tenant encryption"
    });
  }

  // Parse and validate request body
  const body = await readBody(event);
  const parseResult = provisionTenantSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors.map(e => e.message).join(", ")
    });
  }

  const { siteConfigId, clinicSecret } = parseResult.data;
  const siteConfigRepo = cxt.getSiteConfigurationRepository();
  const auditRepo = cxt.getLlmRuleDecisionAuditRepository();
  const phiCrypto = cxt.getPhiCryptoService();

  // Check if site exists and is not already provisioned
  const existingMaterial = await siteConfigRepo.getEncryptionMaterial(siteConfigId);
  if (!existingMaterial) {
    throw createError({
      statusCode: 404,
      statusMessage: "Site configuration not found"
    });
  }

  if (existingMaterial.isEncryptedSetup) {
    throw createError({
      statusCode: 400,
      statusMessage: "This tenant is already provisioned for encryption"
    });
  }

  cxt.logger.info(`Starting encryption provisioning for site ${siteConfigId}`);

  // Step 1 & 2: Generate RSA key pair and encrypt private key with clinic secret
  const provisioningResult = await phiCrypto.provisionTenant(clinicSecret);

  // Step 3: Save the key material (but don't mark as complete yet)
  await siteConfigRepo.saveEncryptionMaterial(siteConfigId, {
    publicKey: provisioningResult.publicKey,
    encryptedPrivateKey: provisioningResult.encryptedPrivateKey.encryptedKey,
    privateKeyIv: provisioningResult.encryptedPrivateKey.iv,
    privateKeyTag: provisioningResult.encryptedPrivateKey.tag,
    privateKeySalt: provisioningResult.encryptedPrivateKey.salt,
    isEncryptedSetup: false // Will set to true after migration
  });

  // Step 4: Migration Loop - encrypt all existing audit records using envelope encryption
  const BATCH_SIZE = 50;
  let totalMigrated = 0;
  let hasMore = true;

  while (hasMore) {
    const unencryptedRecords = await auditRepo.findUnencryptedForSite(siteConfigId, BATCH_SIZE);

    if (unencryptedRecords.length === 0) {
      hasMore = false;
      break;
    }

    for (const record of unencryptedRecords) {
      if (record.reason) {
        // Seal the reason using envelope encryption (public key wraps random DEK)
        const sealed = phiCrypto.seal(record.reason, provisioningResult.publicKey);
        const basicReason = phiCrypto.generateBasicReason(record.reason);

        // Update the record with encrypted data and nullify plaintext
        await auditRepo.updateWithEncryptedReason(record.id!, {
          rowDekWrapped: sealed.wrappedDek,
          reasonCiphertext: sealed.ciphertext,
          reasonIv: sealed.iv,
          reasonTag: sealed.tag,
          basicReason
        });
      } else {
        // No reason to encrypt, just mark as encrypted with empty values
        await auditRepo.updateWithEncryptedReason(record.id!, {
          rowDekWrapped: Buffer.alloc(0),
          reasonCiphertext: Buffer.alloc(0),
          reasonIv: Buffer.alloc(12),
          reasonTag: Buffer.alloc(16),
          basicReason: "No reason provided"
        });
      }
      totalMigrated++;
    }

    cxt.logger.info(`Migrated ${totalMigrated} records so far for site ${siteConfigId}`);

    if (unencryptedRecords.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  // Step 5: Mark as encrypted setup complete
  await siteConfigRepo.saveEncryptionMaterial(siteConfigId, {
    publicKey: provisioningResult.publicKey,
    encryptedPrivateKey: provisioningResult.encryptedPrivateKey.encryptedKey,
    privateKeyIv: provisioningResult.encryptedPrivateKey.iv,
    privateKeyTag: provisioningResult.encryptedPrivateKey.tag,
    privateKeySalt: provisioningResult.encryptedPrivateKey.salt,
    isEncryptedSetup: true
  });

  // Count any remaining (should be 0)
  const remaining = await auditRepo.countUnencryptedForSite(siteConfigId);

  cxt.logger.info(`Encryption provisioning complete for site ${siteConfigId}. Migrated ${totalMigrated} records.`);

  return {
    success: true,
    siteId: siteConfigId,
    message: `Successfully provisioned encryption for tenant. Migrated ${totalMigrated} audit records.`,
    recordsMigrated: totalMigrated,
    recordsRemaining: remaining
  };
});

