import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { oceanServer, oceanClientId, oceanClientSecret } = body;
  const cxt = await toApplicationContext(event);
  const logger = cxt.logger;

  try {
    const oceanClient = cxt.getOceanClientService();
    const response = await oceanClient.testConnection({
      oceanServer,
      oceanClientId,
      oceanClientSecret,
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
