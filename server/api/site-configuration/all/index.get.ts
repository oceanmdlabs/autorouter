import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { SiteConfigurationReference } from "@/src/entities/models/site-configuration";
export default defineEventHandler(
  async (event): Promise<SiteConfigurationReference[]> => {
    const cxt = await toApplicationContext(event);
    if (cxt.getUser()?.roles?.admin !== "system") {
      throw createError({
        statusCode: 403,
        statusMessage: "You are not authorized to access this resource",
      });
    }
    let data = await cxt.getSiteConfigurationRepository().getAll();
    return data;
  }
);
