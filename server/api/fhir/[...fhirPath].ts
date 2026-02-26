import { getDeployUrl } from "@/src/application/services/ocean-server.utils";
import { fhirController } from "@/src/infrastructure/adapters/controllers/fhir.controller";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { RequestData } from "@/src/infrastructure/adapters/netlify/types";
import type { H3Event } from "h3";

const USE_BACKGROUND_FUNCTIONS =
  process.env.USE_BACKGROUND_FUNCTIONS !== "false";

export default defineEventHandler(async (event) => {
  let timerFired = false;
  const timer = setTimeout(() => {
    timerFired = true;
    console.warn(
      `FHIR endpoint: Still processing after 9 seconds for path: ${event.path} (method: ${event.method})`
    );
  }, 9000);

  try {
    if (!USE_BACKGROUND_FUNCTIONS) {
      return await handleCallSynchronously(event);
    }

    const body = await readBody<object>(event);
    const context = await toApplicationContext(event);

    const user = context.getSession()?.user;
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    // Prepare the data to send to the background function
    const backgroundData: RequestData = {
      path: event.path,
      method: event.method,
      body: body,
      user: {
        clientId: user.id,
        name: user.name,
        roles: user.roles,
        tenantId: user.tenantId,
      },
      headers: getHeaders(event),
    };

    // Trigger the background function
    // In production, this would call the Netlify background function
    console.log("Triggering background function with data:", backgroundData);

    // For Netlify background functions, we need to make an HTTP request to trigger it
    try {
      const functionUrl = `${getDeployUrl()}/.netlify/functions/fhir-background`;

      // Make a POST request to trigger the background function
      const response = await $fetch(functionUrl, {
        method: "POST",
        body: JSON.stringify(backgroundData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response)
        console.log(
          "Background function triggered successfully:",
          JSON.stringify(response)
        );
    } catch (error) {
      console.error("Failed to trigger background function:", error);
      return createError({
        statusCode: 500,
        statusMessage: "Failed to trigger background function",
      });
    }

    return Response.json({
      success: true,
      message: "Request queued for background processing",
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in async FHIR endpoint:", error);
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

function getHeaders(event: any) {
  const headers: Record<string, string> = {};
  for (const [key, value] of event.headers.entries()) {
    headers[key] = value;
  }
  return headers;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
