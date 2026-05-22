import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "summarizeAttachments" as const;
const parameters = z.object({
  instructions: z
    .string()
    .describe("Instructions for what to look for in the attachments"),
});

export const summarizeAttachmentsTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description: "Analyze and summarize information from attachments using AI",
  handler: async (action, eventContext, cxt, ruleName) => {
    const { summarizeAttachmentsHandler } = await import(
      "./handlers/summarize-attachments-handler"
    );
    return summarizeAttachmentsHandler(action, eventContext, cxt, ruleName);
  },
};
