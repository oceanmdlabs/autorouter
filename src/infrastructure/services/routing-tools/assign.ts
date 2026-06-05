import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "assign";
const parameters = z.object({
  targetListingName: z.string(),
});

export const assignTool: RoutingToolDefinition<typeof name, typeof parameters> =
  {
    name,
    input: parameters,
    description: "Assign the request to a specific provider",
    handler: async (action, eventContext, cxt, ruleName) => {
      // Dynamically import the handler to avoid loading server-side dependencies on the client
      const { assignHandler } = await import("./handlers/assign-handler");
      return assignHandler(action, eventContext, cxt, ruleName);
    },
    dryRun: async (action, eventContext, cxt) => {
      const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
      if (!serviceRequestBundle) {
        return { payloadType: "ocean-fhir-message", summary: `Assign to: ${action.input.targetListingName}`, payload: {}, error: "No service request bundle available" };
      }
      const { targetListingName } = action.input;
      const targetListing = await cxt.getHealthcareServicesRepository().searchByName(targetListingName);
      if (!targetListing) {
        return { payloadType: "ocean-fhir-message", summary: `Assign to: ${targetListingName}`, payload: {}, error: `Listing '${targetListingName}' not found` };
      }
      const { createAssignMessage } = await import("../ocean-message.service");
      const message = createAssignMessage(serviceRequestBundle, { forwardToListingRef: targetListing.oceanReference });
      return { payloadType: "ocean-fhir-message", summary: `Assign to listing: ${targetListingName}`, payload: message as unknown as Record<string, unknown> };
    },
  };
