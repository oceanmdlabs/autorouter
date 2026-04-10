import type { RoutingToolHandler, ToolExecutionResult } from "@/src/entities/models/routing-tool";
import { createAssignMessage } from "../../ocean-message.service";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "assign";

export const assignHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt
) => {
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

  } else {
    const { targetListingName } = action.input;
    const targetListing = await cxt
      .getHealthcareServicesRepository()
      .searchByName(targetListingName);
    if (!targetListing) {
      error = `The target listing '${targetListingName}' was not found. Make sure you have declared the listing in the Listings section.`;

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
      const message = createAssignMessage(serviceRequestBundle, {
        forwardToListingRef: targetListing.oceanReference
      });
      const response = await cxt.getOceanClientService().sendMessage({
        message
      });
      if (response.status !== 200) {
        error = "Failed to assign service request";
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
  }
  const result: ToolExecutionResult = {
    tool: TOOL_NAME,
    success: !error,
    error: error,
    routingEventContext: eventContext
  };

  return result;

};
