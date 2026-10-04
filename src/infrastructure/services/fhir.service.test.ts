import { describe, expect, it, vi } from "vitest";
import type { Resource } from "fhir/r4";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { createFhirService } from "./fhir.service";

describe("FHIR structural validation", () => {
  const service = createFhirService({
    cxt: { logger: { warn: vi.fn() } } as unknown as ApplicationContext,
  });

  it("accepts a resource with a valid type and identifier", async () => {
    expect(
      await service.validateResource({
        resourceType: "Patient",
        id: "synthetic",
      }),
    ).toMatchObject({ valid: true, issues: [] });
  });

  it("uses FHIR issue codes for invalid and missing resources", async () => {
    expect(
      await service.validateResource(null as unknown as Resource),
    ).toMatchObject({
      valid: false,
      issues: [{ code: "invalid", severity: "error" }],
    });
    expect(await service.validateResource({} as Resource)).toMatchObject({
      valid: false,
      issues: [{ code: "required", severity: "error" }],
    });
  });

  it("reports an invalid identifier as a warning without rejecting the resource", async () => {
    expect(
      await service.validateResource({
        resourceType: "Patient",
        id: 123,
      } as unknown as Resource),
    ).toMatchObject({
      valid: true,
      issues: [{ code: "invalid", severity: "warning" }],
    });
  });
});
