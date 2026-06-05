import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "forward";
const parameters = z.object({
  targetListingName: z.string(),
});

export const forwardTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Forward the request to a specific listing",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { forwardHandler } = await import("./handlers/forward-handler");
    return forwardHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action, eventContext, cxt) => {
    const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    if (!serviceRequestBundle) {
      return { payloadType: "ocean-fhir-message", summary: `Forward to: ${action.input.targetListingName}`, payload: {}, error: "No service request bundle available" };
    }
    const { targetListingName } = action.input;
    const targetListing = await cxt.getHealthcareServicesRepository().searchByName(targetListingName);
    if (!targetListing) {
      return { payloadType: "ocean-fhir-message", summary: `Forward to: ${targetListingName}`, payload: {}, error: `Listing '${targetListingName}' not found` };
    }
    const { createForwardMessage } = await import("../ocean-message.service");
    const message = createForwardMessage(serviceRequestBundle, { forwardToListingRef: targetListing.oceanReference });
    return { payloadType: "ocean-fhir-message", summary: `Forward to listing: ${targetListingName}`, payload: message as unknown as Record<string, unknown> };
  },
};
