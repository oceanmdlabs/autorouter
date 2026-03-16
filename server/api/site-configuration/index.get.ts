import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
export default defineEventHandler(
  async (
    event
  ): Promise<{
    siteConfig: SiteConfiguration | null;
  }> => {
    const cxt = await toApplicationContext(event);
    if (!cxt.getTenantId()) {
      return {
        siteConfig: null,
      };
    }
    let siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
    return {
      siteConfig: siteConfig,
    };
  }
);
