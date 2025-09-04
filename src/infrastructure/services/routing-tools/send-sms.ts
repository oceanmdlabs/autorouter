import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "sendSms";
const parameters = z.object({
  message: z.string(),
  phoneNumber: z.string(),
});

export const sendSmsTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Send an SMS message",
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { sendSmsHandler } = await import("./handlers/send-sms-handler");
    return sendSmsHandler(action, eventContext, cxt);
  },
};
