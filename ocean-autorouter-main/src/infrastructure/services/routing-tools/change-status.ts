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
  displayName: "Change Status",
  input: parameters,
  description: "Accept, decline, or complete the request",
  briefDescription: "Change status",
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { changeStatusHandler } = await import(
      "./handlers/change-status-handler"
    );
    return changeStatusHandler(action, eventContext, cxt);
  },
};
