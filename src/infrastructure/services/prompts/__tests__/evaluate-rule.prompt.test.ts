import type { Bundle } from "fhir/r4";
import fs from "fs";
import { describe, expect, it } from "vitest";
import type { CDSHookRequest } from "@/src/entities/models/cds-hooks";
import { summarizeServiceRequestMessage } from "../service-request-summarizer";

describe("summarizeServiceRequestMessage", () => {
  it("should handle a regular Bundle message", () => {
    const bundle = JSON.parse(
      fs.readFileSync("test/ereferral_back_pain.bundle.json", "utf8")
    );
    // map the fullUrl to ids:
    bundle.en;

    const summary = summarizeServiceRequestMessage(bundle, ["age", "gender", "postalCode"]);
    expect(summary).toContain("Gender: male");
    expect(summary).toContain("Back pain with no red flags");
    expect(summary).toContain(
      "Category: MENTAL_HEALTH_ASSESSMENT_AND_REFERRAL"
    );
    expect(summary).toContain(
      "id-referral-target-reference: autorouter_test49721437"
    );
    expect(summary).toContain("Address: 3080 Yonge St, Toronto, ON, M4P 0C6");

    // Verify PHI is excluded when no fields are opted in
    const summaryNoContext = summarizeServiceRequestMessage(bundle, []);
    expect(summaryNoContext).not.toContain("Gender:");
    expect(summaryNoContext).not.toContain("Age:");
  });

  it("should handle a CDSHookRequest message", () => {
    const cdsHookRequest: CDSHookRequest = {
      hook: "order-sign",
      hookInstance: "123",
      context: {},
      prefetch: {
        v11Bundle: {
          resourceType: "Bundle",
          type: "message",
          entry: [
            {
              resource: {
                resourceType: "MessageHeader",
                eventCoding: {
                  system:
                    "https://ehealthontario.ca/fhir/CodeSystem/message-event-code",
                  code: "add-service-request",
                  display: "add-service-request",
                },
                source: {
                  name: "Test Source",
                  endpoint: "http://test.com",
                },
              },
            },
            {
              resource: {
                resourceType: "ServiceRequest",
                intent: "order",
                status: "active",
                subject: {
                  reference: "Patient/123",
                },
                text: {
                  div: "Service Request Text",
                  status: "generated",
                },
              },
            },
          ],
        },
      },
    };

    const summary = summarizeServiceRequestMessage(
      cdsHookRequest.prefetch?.v11Bundle as Bundle
    );
    expect(summary).toContain("Service Request Summary");
  });

  it("should handle an invalid bundle", () => {
    const invalidBundle: Bundle = {
      resourceType: "Bundle",
      type: "message",
    };

    const summary = summarizeServiceRequestMessage(invalidBundle);
    expect(summary).toBe("No valid bundle found in message");
  });
});
