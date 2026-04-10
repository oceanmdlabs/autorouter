/**
 * Clinic Vault Unlock API (Asymmetric Model)
 *
 * POST /api/clinic/unlock-dek
 *
 * This endpoint:
 * 1. Accepts the clinic_secret from the user
 * 2. Fetches the encrypted private key from site_config
 * 3. Decrypts the private key using the clinic_secret
 * 4. Stores the decrypted private key (PEM) in the server-side session
  */

import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { z } from "zod";

const unlockDekSchema = z.object({
  clinicSecret: z.string().min(8, "Clinic secret must be at least 8 characters")
});

export interface UnlockDekResponse {
  success: boolean;
  message: string;
  unlockedAt: string;
}

export default defineEventHandler(async (event): Promise<UnlockDekResponse> => {
  const session = await requireUserSession(event);
  const cxt = await toApplicationContext(event);

  // Parse and validate request body
  const body = await readBody(event);
  const parseResult = unlockDekSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors.map(e => e.message).join(", ")
    });
  }

  const { clinicSecret } = parseResult.data;
  const siteConfigRepo = cxt.getSiteConfigurationRepository();
  const phiCrypto = cxt.getPhiCryptoService();

  // Get the site ID for the current tenant
  const siteId = await siteConfigRepo.getSiteIdForTenant();
  if (!siteId) {
    throw createError({
      statusCode: 404,
      statusMessage: "No site configuration found for this tenant"
    });
  }

  // Fetch the encryption material
  const encryptionMaterial = await siteConfigRepo.getEncryptionMaterial(siteId);
  if (!encryptionMaterial) {
    throw createError({
      statusCode: 404,
      statusMessage: "No encryption material found for this site"
    });
  }

  if (!encryptionMaterial.isEncryptedSetup) {
    throw createError({
      statusCode: 400,
      statusMessage: "This tenant has not been provisioned for encryption yet"
    });
  }

  if (!encryptionMaterial.encryptedPrivateKey ||
      !encryptionMaterial.privateKeyIv ||
      !encryptionMaterial.privateKeyTag ||
      !encryptionMaterial.privateKeySalt) {
    throw createError({
      statusCode: 500,
      statusMessage: "Incomplete encryption material in database"
    });
  }

  try {
    // Decrypt the private key using the clinic secret
    const privateKey = await phiCrypto.decryptPrivateKey({
      encryptedKey: encryptionMaterial.encryptedPrivateKey,
      iv: encryptionMaterial.privateKeyIv,
      tag: encryptionMaterial.privateKeyTag,
      salt: encryptionMaterial.privateKeySalt
    }, clinicSecret);

    cxt.logger.info(`Private key decrypted successfully, length: ${privateKey.length} chars`);

    // Store the private key in the session
    const unlockedAt = new Date().toISOString();

    const newSession = {
      ...session,
      // Store the private key PEM for decryption operations
      tenantPrivateKey: privateKey,
      dekUnlockedAt: unlockedAt
    };

    cxt.logger.info(`Saving session with tenantPrivateKey present: ${!!newSession.tenantPrivateKey}`);

    await replaceUserSession(event, newSession);

    // Verify the session was saved correctly
    const verifySession = await getUserSession(event);
    cxt.logger.info(`Session verification - tenantPrivateKey present: ${!!(verifySession as any)?.tenantPrivateKey}`);

    cxt.logger.info(`Vault unlocked for tenant ${cxt.getTenantId()}`);

    return {
      success: true,
      message: "Vault unlocked successfully. PHI data is now accessible.",
      unlockedAt
    };

  } catch (error) {
    cxt.logger.warn(`Failed vault unlock attempt for tenant ${cxt.getTenantId()}`, error);
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid clinic secret. Unable to unlock vault."
    });
  }
});

