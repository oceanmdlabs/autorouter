import { createToggleEConsultMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "toggleEConsult";

export const toggleEConsultHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  let details = null;
  let error = null;

  const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
  if (!serviceRequestBundle) {
    error = "No service request bundle available";
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
    } else {
      details = "Toggled eConsult status";
    }
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
}