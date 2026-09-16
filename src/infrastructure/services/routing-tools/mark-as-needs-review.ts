import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "markAsNeedsReview";
const parameters = z.object({
  message: z.string(),
});

export const markAsNeedsReviewTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Mark a service request as needing review with a message",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { markAsNeedsReviewHandler } = await import(
      "./handlers/mark-as-needs-review-handler"
    );
    return markAsNeedsReviewHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action, eventContext) => {
    const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    const summary = `Mark as needs review: "${action.input.message}"`;
    if (!serviceRequestBundle) {
      return { payloadType: "ocean-fhir-message", summary, payload: {}, error: "No service request bundle available" };
    }
    const { createSendCommunicationFromRequesterMessage } = await import("../ocean-message.service");
    const message = createSendCommunicationFromRequesterMessage(serviceRequestBundle, {
      message: "Autorouter marked as needing review: " + action.input.message,
    });
    return { payloadType: "ocean-fhir-message", summary, payload: message as unknown as Record<string, unknown> };
  },
};
