import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "comment";
const parameters = z.object({
  comment: z.string()
});

export const commentTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  displayName: "Add Comment",
  input: parameters,
  description: "Add a comment to the Autorouter's Activity Log",
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { commentHandler } = await import("./handlers/comment-handler");
    return commentHandler(action, eventContext, cxt);
  }
};
