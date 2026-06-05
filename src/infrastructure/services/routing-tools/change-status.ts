import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const changeStatusSchema = z.object({
  status: z.enum(["accepted", "rejected", "completed"]),
  reason: z.string().optional(),
});

const name = "changeStatus";
const parameters = changeStatusSchema;

export const changeStatusTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Accept, decline, or complete the request",
  briefDescription: "Change status",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { changeStatusHandler } = await import(
      "./handlers/change-status-handler"
    );
    return changeStatusHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action, eventContext) => {
    const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    const labels: Record<string, string> = { accepted: "Accept", rejected: "Decline", completed: "Complete" };
    const summary = `Change status to ${action.input.status}`;
    if (!serviceRequestBundle) {
      return { payloadType: "ocean-fhir-message", summary, payload: {}, error: "No service request bundle available" };
    }
    const { createStatusChangeMessage } = await import("../ocean-message.service");
    const message = createStatusChangeMessage(serviceRequestBundle, {
      status: action.input.status as any,
      reason: action.input.reason ?? "",
      description: labels[action.input.status] ?? "",
    });
    return { payloadType: "ocean-fhir-message", summary, payload: message as unknown as Record<string, unknown> };
  },
};
