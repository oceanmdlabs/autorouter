import type {
  IFhirService,
  ValidationResponse,
} from "@/src/application/services/fhir.service.interface";
import type { Resource } from "fhir/r4";

import { Fhir } from "fhir";
import { ApplicationContext } from "@/src/entities/models/application-context";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createFhirService = (deps: Dependencies): IFhirService => {
  const { cxt } = deps;
  const fhir = new Fhir();

  async function validateResource(
    resource: Resource
  ): Promise<ValidationResponse> {
    const response = fhir.validate(resource, {});
    const issues = response.messages.map((m) => {
      return {
        code: "validation_error",
        details: {
          text: `${m.resourceId}:${m.location}: ${m.severity} ${m.message}`,
        },
        severity: (m.severity ?? "error") as
          | "fatal"
          | "error"
          | "warning"
          | "information",
      };
    });
    const significantIssues = issues.filter(isSignificantWarning);
    const description =
      (response.valid ? "Valid FHIR: " : "Invalid FHIR: ") +
      issues.map((i) => i.details.text).join("; ");
    if (significantIssues.length > 0) {
      cxt.logger.warn(`Validation issues: ${description}`);
    }
    return {
      valid: response.valid,
      issues: significantIssues,
      description: description,
    };
  }
  return {
    validateResource,
  };
};

function isSignificantWarning(i: {
  code: string;
  details: { text: string };
  severity: "fatal" | "error" | "warning" | "information";
}): boolean {
  return (
    i.severity !== "information" &&
    (!i.details.text.toLowerCase().includes("value set") || // ignore value set warnings
      i.severity === "fatal" ||
      i.severity === "error")
  );
}
