/**
 * Clinic Vault Lock API
 *
 * POST /api/clinic/lock-dek
 *
 * This endpoint clears the private key from the user's session,
 * effectively "locking" the vault and preventing PHI access.
 */

import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export interface LockDekResponse {
  success: boolean;
  message: string;
}

export default defineEventHandler(async (event): Promise<LockDekResponse> => {
  const session = await requireUserSession(event);
  const cxt = await toApplicationContext(event);

  // Check if there's a private key to clear
  const wasUnlocked = !!session.tenantPrivateKey;

  // Clear the private key from the session
  await replaceUserSession(event, {
    ...session,
    tenantPrivateKey: undefined,
    dekUnlockedAt: undefined
  });

  if (wasUnlocked) {
    cxt.logger.info(`Vault locked for tenant ${cxt.getTenantId()}`);
  }

  return {
    success: true,
    message: wasUnlocked
      ? "Vault locked successfully. PHI data is no longer accessible."
      : "Vault was already locked."
  };
});

