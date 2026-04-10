import { createSendCommunicationMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "summarizeAttachments";

export const summarizeAttachmentsHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const { instructions } = action.input;
  let details = null;
  let error = null;
  const attachments =
    "attachments" in eventContext ? eventContext.attachments : null;
  const serviceRequestBundle =
    "serviceRequestBundle" in eventContext
      ? eventContext.serviceRequestBundle
      : null;
  if (!serviceRequestBundle) {
    error = "No service request bundle available";

    const logDetails: LogToolEvent = {
      event: "tool.execution.error",
      message: error,
      tool: TOOL_NAME,
      timestamp: new Date().toISOString(),
      referralRef: getReferralRef(eventContext),
      actionId: action.id
    };

    cxt.logger.error(logDetails);

  } else {
    if (!attachments || attachments.length === 0) {

      return {
        tool: TOOL_NAME,
        success: true,
        error: null,
        routingEventContext: eventContext
      };
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
      serviceRequestBundle,
      {
        message: `Attachment Summary: ${summary}`
      }
    );

    const response = await cxt.getOceanClientService().sendMessage({
      message,
      version: "v12"
    });
    if (response.status !== 200) {

      error = "Failed to send communication to provider (attachment analysis)";

      const logDetails: LogToolEvent = {
        event: "tool.execution.error",
        message: `Failed to assign service request: ${response.status}`,
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };

      cxt.logger.error(logDetails);

    } else {
      const logDetails: LogToolEvent = {
        event: "tool.execution.success",
        message: "Service request assigned successfully",
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };
      cxt.logger.info(logDetails);
    }
  }

  return {
    tool: TOOL_NAME,
    success: !error,
    error: error,
    routingEventContext: eventContext
  };

};
