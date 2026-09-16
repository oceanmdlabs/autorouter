import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "sendEmail";
const parameters = z.object({
  to: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string(),
  message: z.string(),
});

export const sendEmailTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Send an email message to the specified recipient",
  handler: async (action, eventContext, cxt, ruleName) => {
    // Dynamically import the handler to reduce cold start times
    const { sendEmailHandler } = await import("./handlers/send-email-handler");
    return await sendEmailHandler(action, eventContext, cxt, ruleName);
  },
  dryRun: async (action) => {
    const { to, cc, bcc, subject, message } = action.input;
    return {
      payloadType: "email",
      summary: `Email to ${to}: "${subject}"`,
      payload: { to, ...(cc ? { cc } : {}), ...(bcc ? { bcc } : {}), subject, message },
    };
  },
};
