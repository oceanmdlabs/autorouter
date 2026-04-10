import { createDataCorrectionMessageWithNewCode } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

const TOOL_NAME = "updateCategory";

export const updateCategoryHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const { snomedCode } = action.input;

  let details = null;
  let error = null;
  if (!snomedCode) {
    error = "No SNOMED code provided";
  }
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
    const message = await createDataCorrectionMessageWithNewCode(
      serviceRequestBundle,
      {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: snomedCode,
            display: snomedCode
          }
        ]
      }
    );
    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {


      error = "Failed to change service request category";
      const logDetails: LogToolEvent = {
        event: "tool.execution.error",
        message: `Failed to change service request category: ${response.status}`,
        tool: TOOL_NAME,
        timestamp: new Date().toISOString(),
        referralRef: getReferralRef(eventContext),
        actionId: action.id
      };

      cxt.logger.error(logDetails);
    } else {
      const logDetails: LogToolEvent = {
        event: "tool.execution.success",
        message: "Category updated successfully",
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
