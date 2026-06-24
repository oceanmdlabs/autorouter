import { createSendCommunicationMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "summarizeAttachments";

export const summarizeAttachmentsHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const { instructions } = action.input;
  let details = null;
  let error = null;
  let summary: string | undefined;
  const attachments =
    "attachments" in eventContext ? eventContext.attachments : null;
  const serviceRequestBundle =
    "serviceRequestBundle" in eventContext
      ? eventContext.serviceRequestBundle
      : null;
  if (!serviceRequestBundle) {
    error = "No service request bundle available";
  } else {
    if (!attachments || attachments.length === 0) {
      await cxt.getActivityLogEntriesRepository().create({
        ...eventContext,
        tool: TOOL_NAME,
        details: "No attachments found to analyze",
      });
      return;
    }

    const cachedSummary =
      "attachmentSummary" in eventContext ? eventContext.attachmentSummary : undefined;

    if (!cachedSummary) {
      cxt.logger.warn("summarizeAttachments tool fired without attachments context opt-in; skipping.");
      await cxt.getActivityLogEntriesRepository().create({
        ...eventContext,
        tool: TOOL_NAME,
        details: null,
        error: "Attachment summarization requires the Attachments context field to be enabled for this rule.",
      });
      return;
    }

    summary = cachedSummary;

    const message = createSendCommunicationMessage(
      serviceRequestBundle,
      {
        message: `Attachment Summary: ${summary}`,
      }
    );

    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {
      cxt.logger.warn(
        `Failed to send communication to provider (attachment analysis): ${response.status}`
      );
      error = "Failed to send communication to provider (attachment analysis)";
    } else {
      details = `Attachment analysis completed and sent: "${summary}"`;
    }
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });

  return summary !== undefined ? `Attachment Summary: ${summary}` : undefined;
};
