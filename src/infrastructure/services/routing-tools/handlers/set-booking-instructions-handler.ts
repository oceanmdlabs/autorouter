import { createSetBookingInstructionsMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

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
  } else {
    const message = createSetBookingInstructionsMessage(
      serviceRequestBundle,
      action.input
    );

    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {
      cxt.logger.warn(
        `Failed to send booking instructions: ${response.status}`
      );
      error = "Failed to send booking instructions";
    } else {
      details = `Sent booking instructions: "${action.input.message}"`;
    }
  }
  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
