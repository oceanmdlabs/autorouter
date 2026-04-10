import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import { createForwardMessage } from "../../ocean-message.service";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "forward";

export const forwardHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt) => {

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
      const message = createForwardMessage(serviceRequestBundle, {
        forwardToListingRef: targetListing.oceanReference
      });
      const response = await cxt.getOceanClientService().sendMessage({ message });
      if (response.status !== 200) {
        error =
          `Failed to forward service request. Among other causes, ensure the destination has a matching health service category. : ${response.status}`;

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
          message: "Service request forwarded successfully",
          tool: TOOL_NAME,
          timestamp: new Date().toISOString(),
          referralRef: getReferralRef(eventContext),
          actionId: action.id
        };
        cxt.logger.info(logDetails);
      }
    }
  }

  return {
    tool: TOOL_NAME,
    success: !error,
    error: error,
    routingEventContext: eventContext
  };
};