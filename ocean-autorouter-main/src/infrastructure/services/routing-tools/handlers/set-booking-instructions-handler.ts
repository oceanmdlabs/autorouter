import { createSetBookingInstructionsMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "setBookingInstructions";

export const setBookingInstructionsHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  let details = null;
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
    const message = createSetBookingInstructionsMessage(
      serviceRequestBundle,
      action.input
    );

    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {
      error = "Failed to send booking instructions";
      const logDetails: LogToolEvent = {
        event: "tool.execution.error",
        tool: TOOL_NAME,
        message: `Failed to send booking instructions: ${response.status}`,
        actionId: action.id,
        referralRef: getReferralRef(eventContext),
        timestamp: new Date().toISOString()
      };
      cxt.logger.error(logDetails);
    } else {
      const logDetails: LogToolEvent = {
        event: "tool.execution.succeeded",
        tool: TOOL_NAME,
        message: `Successfully sent booking instructions.`,
        actionId: action.id,
        referralRef: getReferralRef(eventContext),
        timestamp: new Date().toISOString()
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
