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
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { markAsNeedsReviewHandler } = await import(
      "./handlers/mark-as-needs-review-handler"
    );
    return markAsNeedsReviewHandler(action, eventContext, cxt);
  },
};
