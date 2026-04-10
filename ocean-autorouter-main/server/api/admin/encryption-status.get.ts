/**
 * Admin API to get encryption status for all tenants
 *
 * GET /api/admin/encryption-status
 *
 * Returns a list of all tenants with their encryption provisioning status
 */

import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { TenantEncryptionStatus } from "@/src/application/repositories/site-configuration.repository.interface";

export interface EncryptionStatusResponse {
  tenants: TenantEncryptionStatus[];
  totalProvisioned: number;
  totalPending: number;
}

export default defineEventHandler(async (event): Promise<EncryptionStatusResponse> => {
  const cxt = await toApplicationContext(event);

  // Require system admin role
  if (cxt.getUser()?.roles?.admin !== "system") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only system administrators can view encryption status"
    });
  }

  const siteConfigRepo = cxt.getSiteConfigurationRepository();
  const tenants = await siteConfigRepo.getAllEncryptionStatus();

  const totalProvisioned = tenants.filter(t => t.isEncryptedSetup).length;
  const totalPending = tenants.filter(t => !t.isEncryptedSetup).length;

  return {
    tenants,
    totalProvisioned,
    totalPending
  };
});

