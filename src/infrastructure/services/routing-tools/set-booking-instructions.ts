import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "setBookingInstructions";
const parameters = z.object({
  message: z.string(),
});

export const setBookingInstructionsTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Provide booking instructions",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { setBookingInstructionsHandler } = await import(
      "./handlers/set-booking-instructions-handler"
    );
    return setBookingInstructionsHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action, eventContext) => {
    const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    const summary = `Set booking instructions: "${action.input.message}"`;
    if (!serviceRequestBundle) {
      return { payloadType: "ocean-fhir-message", summary, payload: {}, error: "No service request bundle available" };
    }
    const { createSetBookingInstructionsMessage } = await import("../ocean-message.service");
    const message = createSetBookingInstructionsMessage(serviceRequestBundle, action.input);
    return { payloadType: "ocean-fhir-message", summary, payload: message as unknown as Record<string, unknown> };
  },
};
