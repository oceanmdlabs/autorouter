import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { resolveMaskedSecretForUpdate } from "@/server/utils/site-configuration-secrets";

export default defineEventHandler(async (event) => {
  await requireUserSession(event);
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);
  const logger = cxt.logger;

  try {
    const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
    const oceanClientSecret = resolveMaskedSecretForUpdate(
      body?.oceanClientSecret,
      siteConfig?.oceanClientSecret,
    );
    const oceanClient = cxt.getOceanClientService();
    const response = await oceanClient.testConnection({
      oceanServer: body?.oceanServer,
      oceanClientId: body?.oceanClientId,
      oceanClientSecret: oceanClientSecret ?? "",
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        error: `Connection failed with status ${response.status}: ${errorText}`,
      };
    }
  } catch (error: any) {
    logger.error("Failed to test Ocean connection:", error);
    return {
      success: false,
      error: error.message || "Failed to test connection",
    };
  }
});
