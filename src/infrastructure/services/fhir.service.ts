import type {
  IFhirService,
  ValidationResponse,
} from "@/src/application/services/fhir.service.interface";
import type { OperationOutcomeIssue, Resource } from "fhir/r4";

import { ApplicationContext } from "@/src/entities/models/application-context";

type Dependencies = {
  cxt: ApplicationContext;
};

type StructuralValidationIssue = OperationOutcomeIssue & {
  details: { text: string };
};

export const createFhirService = (deps: Dependencies): IFhirService => {
  const { cxt } = deps;

  async function validateResource(
    resource: Resource,
  ): Promise<ValidationResponse> {
    const issues = collectStructuralValidationIssues(resource);
    const valid = issues.every((issue) => issue.severity !== "error");
    const significantIssues = issues.filter(isSignificantWarning);
    const description =
      (valid ? "Valid FHIR: " : "Invalid FHIR: ") +
      (issues.map((i) => i.details.text).join("; ") || "No issues.");
    if (significantIssues.length > 0) {
      cxt.logger.warn(`Validation issues: ${description}`);
    }
    return {
      valid,
      issues: significantIssues,
      description: description,
    };
  }
  return {
    validateResource,
  };
};

function isSignificantWarning(i: StructuralValidationIssue): boolean {
  return (
    i.severity !== "information" &&
    (!i.details.text.toLowerCase().includes("value set") || // ignore value set warnings
      i.severity === "fatal" ||
      i.severity === "error")
  );
}

function collectStructuralValidationIssues(resource: Resource) {
  const issues: StructuralValidationIssue[] = [];
  if (!resource || typeof resource !== "object") {
    issues.push({
      code: "invalid",
      details: {
        text: "resource:error: Resource payload is missing or invalid.",
      },
      severity: "error",
    });
    return issues;
  }
  if (!resource.resourceType || typeof resource.resourceType !== "string") {
    issues.push({
      code: "required",
      details: { text: "resourceType:error: Missing resourceType." },
      severity: "error",
    });
  }
  if (
    "id" in resource &&
    resource.id != null &&
    typeof resource.id !== "string"
  ) {
    issues.push({
      code: "invalid",
      details: {
        text: "id:warning: Resource id should be a string when present.",
      },
      severity: "warning",
    });
  }
  return issues;
}
