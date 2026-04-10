import { fhirController } from "@/src/infrastructure/adapters/controllers/fhir.controller";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
  const timer = setTimeout(() => {
    console.warn(
      `FHIR endpoint: Still processing after 9 seconds for path: ${event.path} (method: ${event.method})`
    );
  }, 9000);

  try {
    return await handleCallSynchronously(event);
  } catch (error) {
    console.error("Error in FHIR endpoint:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error",
    });
  } finally {
    clearTimeout(timer);
  }
});

async function handleCallSynchronously(event: H3Event) {
  const body = await readBody<object>(event);
  const response = await fhirController(
    {
      path: event.path,
      method: event.method,
      body: body,
    },
    await toApplicationContext(event)
  );
  return response;
}
