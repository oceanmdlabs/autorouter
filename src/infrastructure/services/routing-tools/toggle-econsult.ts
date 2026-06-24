import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "toggleEConsult";
const parameters = z.object({
  changeToEConsult: z.boolean(),
});

export const toggleEConsultTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Change an eReferral to an eConsult or vice versa",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { toggleEConsultHandler } = await import(
      "./handlers/toggle-econsult-handler"
    );
    return toggleEConsultHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action, eventContext) => {
    const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    const summary = `Toggle to ${action.input.changeToEConsult ? "eConsult" : "eReferral"}`;
    if (!serviceRequestBundle) {
      return { payloadType: "ocean-fhir-message", summary, payload: {}, error: "No service request bundle available" };
    }
    const { createToggleEConsultMessage } = await import("../ocean-message.service");
    const message = createToggleEConsultMessage(serviceRequestBundle, { changeToEConsult: action.input.changeToEConsult });
    return { payloadType: "ocean-fhir-message", summary, payload: message as unknown as Record<string, unknown> };
  },
};
