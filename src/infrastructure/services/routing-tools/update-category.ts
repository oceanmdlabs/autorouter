import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "updateCategory";
const parameters = z.object({
  snomedCode: z.string(),
});

export const updateCategoryTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Update the health service category of the request",
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { updateCategoryHandler } = await import(
      "./handlers/update-category-handler"
    );
    return updateCategoryHandler(action, eventContext, cxt);
  },
};
