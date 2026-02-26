import { ApplicationContext } from "@/src/entities/models/application-context";
import type { HttpResponseInit } from "@/src/entities/models/http";
import { processMessageController } from "@/src/infrastructure/adapters/controllers/process-message.controller";
import { createFhirService } from "@/src/infrastructure/services/fhir.service";
import { startSpan } from "@sentry/node";
import type { Resource } from "fhir/r4";

export async function fhirController(
  { method, body, path }: { path: string; method: string; body: object },
  cxt: ApplicationContext
): Promise<HttpResponseInit> {
  return await startSpan({ name: "$fhir.controller" }, async () => {
    cxt.logger.info("FHIR controller received a request.");
    const fhirPath = path.split("/fhir/")[1];
    if (!fhirPath) {
      return {
        status: 400,
        body: "FHIR path is required.",
      };
    }
    if (body) {
      const fhirService = createFhirService({ cxt });
      const validationResult = await fhirService.validateResource(
        body as unknown as Resource
      );
      if (!validationResult.valid) {
        return {
          status: 400,
          body: `Invalid FHIR resource: ${validationResult.description}`,
        };
      } else if (
        validationResult.issues.filter((issue) => issue.severity === "error")
          .length > 0
      ) {
        cxt.logger.warn(`Validation issues: ${validationResult.description}`);
      }
    }
    if (!cxt.getSession().user) {
      return {
        status: 400,
        body: "User is required.",
      };
    }
    if (
      fhirPath === "$process-message" ||
      fhirPath === "async/$process-message"
    ) {
      return await processMessageController({ method, body }, cxt);
    } else {
      cxt.logger.warn(`Unsupported FHIR path: ${fhirPath}`);
    }
    return {
      status: 200,
      body: JSON.stringify({ message: "Received" }),
    };
  });
}
