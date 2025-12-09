import { createSendCommunicationMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "summarizeAttachments";

export const summarizeAttachmentsHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const { instructions } = action.input;
  const { attachments } = eventContext;

  if (!attachments || attachments.length === 0) {
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      tool: TOOL_NAME,
      details: "No attachments found to analyze",
    });
    return;
  }

  const aiService = cxt.getAiService();

  let summary: string | undefined;
  try {
    summary = await aiService.summarizeAttachments(instructions, attachments);
  } catch (error) {
    cxt.logger.error(`Error analyzing attachments:`, error);
    summary = `Error analyzing attachments: ${(error as Error).message}`;
  }

  const message = createSendCommunicationMessage(
    eventContext.serviceRequestBundle,
    {
      message: `Attachment Summary: ${summary}`,
    }
  );

  let details = null;
  let error = null;

  const response = await cxt.getOceanClientService().sendMessage({
    message,
    version: "v12",
  });
  if (response.status !== 200) {
    cxt.logger.warn(
      `Failed to send communication to provider (attachment analysis): ${response.status}`
    );
    error = "Failed to send communication to provider (attachment analysis)";
  } else {
    details = `Attachment analysis completed and sent: "${summary}"`;
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
