import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "updateCategory";
const parameters = z.object({
  snomedCode: z.string(),
});

export const updateCategoryTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Update the health service category of the request",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { updateCategoryHandler } = await import(
      "./handlers/update-category-handler"
    );
    return updateCategoryHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action, eventContext) => {
    const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    const summary = `Update category to SNOMED: ${action.input.snomedCode}`;
    if (!serviceRequestBundle) {
      return { payloadType: "ocean-fhir-message", summary, payload: {}, error: "No service request bundle available" };
    }
    const { createDataCorrectionMessageWithNewCode } = await import("../ocean-message.service");
    const message = await createDataCorrectionMessageWithNewCode(serviceRequestBundle, {
      coding: [{ system: "http://snomed.info/sct", code: action.input.snomedCode, display: action.input.snomedCode }],
    });
    return { payloadType: "ocean-fhir-message", summary, payload: message as unknown as Record<string, unknown> };
  },
};
