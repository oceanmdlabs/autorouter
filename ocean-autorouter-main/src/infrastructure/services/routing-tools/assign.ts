import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "assign";
const parameters = z.object({
  targetListingName: z.string()
});

export const assignTool: RoutingToolDefinition<typeof name, typeof parameters> =
  {
    name,
    displayName: "Assign to Provider",
    input: parameters,
    description: "Assign the request to a specific provider",
    handler: async (action, eventContext, cxt) => {
      // Dynamically import the handler to avoid loading server-side dependencies on the client
      const { assignHandler } = await import("./handlers/assign-handler");
      return assignHandler(action, eventContext, cxt);
    }
  };
