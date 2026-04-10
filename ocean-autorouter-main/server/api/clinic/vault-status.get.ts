/**
 * Clinic Vault Status API
 *
 * GET /api/clinic/vault-status
 *
 * Returns the current vault status for the session.
 */

import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export interface VaultStatusResponse {
  isProvisioned: boolean;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

export default defineEventHandler(async (event): Promise<VaultStatusResponse> => {
  const session = await requireUserSession(event);
  const cxt = await toApplicationContext(event);

  cxt.logger.debug(`Vault status check - session has tenantPrivateKey: ${!!session.tenantPrivateKey}, dekUnlockedAt: ${session.dekUnlockedAt}`);

  const siteConfigRepo = cxt.getSiteConfigurationRepository();

  // Get the site ID for the current tenant
  const siteId = await siteConfigRepo.getSiteIdForTenant();

  let isProvisioned = false;

  if (siteId) {
    const encryptionMaterial = await siteConfigRepo.getEncryptionMaterial(siteId);
    isProvisioned = encryptionMaterial?.isEncryptedSetup ?? false;
  }

  const result = {
    isProvisioned,
    isUnlocked: !!session.tenantPrivateKey,
    unlockedAt: session.dekUnlockedAt ?? null
  };

  cxt.logger.debug(`Vault status result: ${JSON.stringify(result)}`);

  return result;
});

