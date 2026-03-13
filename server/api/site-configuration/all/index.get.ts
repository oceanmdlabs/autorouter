import type { SiteConfigurationReference } from "@/src/entities/models/site-configuration";
import { assertSystemAdminAccess } from "@/server/utils/system-admin-access";
import { siteConfig } from "@/drizzle/schema";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { asc } from "drizzle-orm";
export default defineEventHandler(
  async (event): Promise<SiteConfigurationReference[]> => {
    const session = await requireUserSession(event);
    await assertSystemAdminAccess(session.user);

    const db = createDbClient();
    return await db
      .select({
        id: siteConfig.id,
        name: siteConfig.name,
        tenantId: siteConfig.tenantId,
      })
      .from(siteConfig)
      .orderBy(asc(siteConfig.name), asc(siteConfig.tenantId));
  }
);
