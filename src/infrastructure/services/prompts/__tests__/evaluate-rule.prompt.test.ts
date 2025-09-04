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

    const summary = summarizeServiceRequestMessage(bundle);
    expect(summary).toContain("Gender: male");
    expect(summary).toContain("Back pain with no red flags");
    expect(summary).toContain(
      "Category: MENTAL_HEALTH_ASSESSMENT_AND_REFERRAL"
    );
    expect(summary).toContain(
      "id-referral-target-reference: autorouter_test49721437"
    );
    expect(summary).toContain("Address: 3080 Yonge St, Toronto, ON, M4P 0C6");
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
                text: {
                  div: "Service Request Text",
                },
              },
            },
          ],
        },
      },
    };

    const summary = summarizeServiceRequestMessage(cdsHookRequest);
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
