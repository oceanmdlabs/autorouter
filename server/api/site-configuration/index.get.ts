import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { maskSiteConfigurationSecrets } from "@/server/utils/site-configuration-secrets";
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
      siteConfig: maskSiteConfigurationSecrets(siteConfig),
    };
  }
);
