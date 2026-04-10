import { createToggleEConsultMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "toggleEConsult";

export const toggleEConsultHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  let details = null;
  let error = null;

  const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
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
  }
  else {
    const message = createToggleEConsultMessage(
      serviceRequestBundle,
      { changeToEConsult: action.input.changeToEConsult }
    );
    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {
      cxt.logger.warn(`Failed to toggle eConsult status: ${response.status}`);
      error = "Failed to toggle eConsult status";
      const logDetails: LogToolEvent = {
        event: "tool.execution.error",
        message: `Failed to toggle eConsult ${response.status}`,
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };

      cxt.logger.error(logDetails);
    } else {
      const logDetails: LogToolEvent = {
        event: "tool.execution.success",
        message: "eConsult toggled successfully",
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
}