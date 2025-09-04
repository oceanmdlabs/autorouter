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
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { toggleEConsultHandler } = await import(
      "./handlers/toggle-econsult-handler"
    );
    return toggleEConsultHandler(action, eventContext, cxt);
  },
};
