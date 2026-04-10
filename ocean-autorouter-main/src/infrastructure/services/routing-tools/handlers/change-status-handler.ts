import {
  createStatusChangeMessage,
  type TaskStatus
} from "../../ocean-message.service";
import type {
  RoutingToolAction,
  RoutingToolHandler, ToolExecutionResult
} from "@/src/entities/models/routing-tool";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "changeStatus";

export const changeStatusHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt
) => {
  let error = null;
  const description = getDescriptionForStatusChange(action);
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

  } else {
    const message = createStatusChangeMessage(serviceRequestBundle, {
      status: action.input.status as TaskStatus,
      reason: action.input.reason ?? "",
      description: description
    });
    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {
      error = `Failed to ${action.input.status} service request`;

      const logDetails: LogToolEvent = {
        event: "tool.execution.error",
        message: "Error changing service request status, status code: " + response.status,
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };

      cxt.logger.error(logDetails);

    } else {
      const logDetails: LogToolEvent = {
        event: "tool.execution.success",
        message: "Service request status changed successfully",
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };
      cxt.logger.info(logDetails);
    }
  }
  const result: ToolExecutionResult = {
    tool: TOOL_NAME,
    success: !error,
    error: error,
    routingEventContext: eventContext
  };

  return result;
};

function getDescriptionForStatusChange(
  action: RoutingToolAction<"changeStatus">
): string {
  switch (action.input.status) {
    case "accepted":
      return "Accept";
    case "rejected":
      return "Decline";
    case "completed":
      return "Complete";
    default:
      throw new Error(`Unknown status: ${action.input.status}`);
  }
}


