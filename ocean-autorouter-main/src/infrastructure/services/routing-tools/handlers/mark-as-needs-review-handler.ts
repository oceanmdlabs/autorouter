import { createSendCommunicationMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "markAsNeedsReview";

export const markAsNeedsReviewHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  let error = null;

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
    const message = createSendCommunicationMessage(
      serviceRequestBundle,
      {
        message: "Autorouter marked as needing review: " + action.input.message
      }
    );

    const response = await cxt.getOceanClientService().sendMessage({
      message,
      version: "v12"
    });
    if (response.status !== 200) {

      error =
        `Failed to send communication to provider (to mark as needing review): ${response.status}`;
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
      const logDetails: LogToolEvent = {
        event: "tool.execution.success",
        message: "Communication sent to provider successfully to mark as needing review",
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
