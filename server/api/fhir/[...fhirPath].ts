import { fhirController } from "@/src/infrastructure/adapters/controllers/fhir.controller";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const timer = setTimeout(() => {
    console.warn(
      `FHIR endpoint: Still processing after 9 seconds for path: ${event.path} (method: ${event.method})`
    );
  }, 9000);

  try {
    const cxt = await toApplicationContext(event);
    if (!cxt.getSession().user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }
    const body = await readBody<object>(event);
    return await fhirController(
      {
        path: event.path,
        method: event.method,
        body,
      },
      cxt
    );
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("Error in FHIR endpoint:", error);
    throw createError({ statusCode: 500, statusMessage: "Internal server error" });
  } finally {
    clearTimeout(timer);
  }
});
