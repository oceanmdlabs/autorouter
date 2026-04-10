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
  displayName: "Forward Request",
  input: parameters,
  description: "Forward the request to a specific listing",
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { forwardHandler } = await import("./handlers/forward-handler");
    return forwardHandler(action, eventContext, cxt);
  },
};
