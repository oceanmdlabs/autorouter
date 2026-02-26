import { createSendCommunicationFromProviderMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "sendCommunicationToRequester";

export const sendCommunicationHandler: RoutingToolHandler<
  typeof TOOL_NAME
  > = async (action, eventContext, cxt) => {
  let details = null;
  let error = null;

  const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
    if (!serviceRequestBundle) {
      error = "No service request bundle available";
    }
    else {
      const message = createSendCommunicationFromProviderMessage(
        serviceRequestBundle,
        action.input
      );

      const response = await cxt.getOceanClientService().sendMessage({ message });
      if (response.status !== 200) {
        cxt.logger.warn(
          `Failed to send communication to requester: ${response.status}`
        );
        error = "Failed to send communication to requester";
      } else {
        details = `Sent communication to requester: "${action.input.message}"`;
      }

      await cxt.getActivityLogEntriesRepository().create({
        ...eventContext,
        tool: TOOL_NAME,
        details,
        error,
      });
    }
  }