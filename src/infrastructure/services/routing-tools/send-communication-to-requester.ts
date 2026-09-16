import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "sendCommunicationToRequester";
const parameters = z.object({
  message: z.string(),
});

export const sendCommunicationTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Send a message to the referrer",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { sendCommunicationHandler } = await import(
      "./handlers/send-communication-handler"
    );
    return sendCommunicationHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action, eventContext) => {
    const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    const summary = `Send message to referrer: "${action.input.message}"`;
    if (!serviceRequestBundle) {
      return { payloadType: "ocean-fhir-message", summary, payload: {}, error: "No service request bundle available" };
    }
    const { createSendCommunicationMessage } = await import("../ocean-message.service");
    const message = createSendCommunicationMessage(serviceRequestBundle, action.input);
    return { payloadType: "ocean-fhir-message", summary, payload: message as unknown as Record<string, unknown> };
  },
};
