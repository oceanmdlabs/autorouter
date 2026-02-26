import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "sendCommunicationToRequester";
const parameters = z.object({
  message: z.string(),
});

export const sendCommunicationTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Send a message to the referrer",
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { sendCommunicationHandler } = await import(
      "./handlers/send-communication-handler"
    );
    return sendCommunicationHandler(action, eventContext, cxt);
  },
};
