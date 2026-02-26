import type { HandlerEvent } from "@netlify/functions";
import { fhirController } from "@/src/infrastructure/adapters/controllers/fhir.controller";
import { ApplicationContext } from "@/src/entities/models/application-context";
import { DefaultLogger } from "@/src/entities/models/logger";
import type { RequestData } from "@/src/infrastructure/adapters/netlify/types";
import { UnauthorizedError } from "@/src/entities/errors/auth";

/**
 * Parse the request body from a Netlify function event
 * Handles both string and ReadableStream body types
 */
async function parseRequestData(event: HandlerEvent): Promise<RequestData> {
  if (!event.body) {
    return {};
  }

  if (typeof event.body === "string") {
    return JSON.parse(event.body);
  }

  if (
    event.body &&
    typeof event.body === "object" &&
    "getReader" in event.body
  ) {
    // Handle ReadableStream
    const reader = (event.body as any).getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const bodyText = new TextDecoder().decode(
      new Uint8Array(
        chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[])
      )
    );
    return JSON.parse(bodyText);
  }

  return {};
}

/**
 * Netlify Background Function for FHIR Processing
 *
 * This is a platform-specific adapter that bridges the application logic
 * with Netlify's serverless infrastructure. It follows clean architecture
 * by keeping platform-specific code in the infrastructure layer.
 */
export default async function handler(event: HandlerEvent) {
  // Parse the event body which contains the FHIR request data
  const requestData = await parseRequestData(event);

  if (!requestData.user) {
    throw new UnauthorizedError("User is required");
  }
  const user = {
    id: requestData.user.clientId,
    name: requestData.user.name,
    roles: requestData.user.roles,
    tenantId: requestData.user.tenantId,
  };

  const cxt = new ApplicationContext(new DefaultLogger());
  cxt.setSession({ user });

  try {
    cxt.logger.info(
      `Background function triggered at tenantId: ${requestData.user.tenantId} for clientId: ${requestData.user.clientId}`
    );

    // Process the FHIR request using the existing controller
    const response = await fhirController(
      {
        path: requestData.path || "",
        method: requestData.method || "GET",
        body: requestData.body,
      },
      cxt
    );

    cxt.logger.info("Background function completed successfully:", response);
    return Response.json({ success: true, response });
  } catch (error) {
    cxt.logger.error("Background function error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
