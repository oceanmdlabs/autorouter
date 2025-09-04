import { createToggleEConsultMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "toggleEConsult";

export const toggleEConsultHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const message = createToggleEConsultMessage(
    eventContext.serviceRequestBundle,
    { changeToEConsult: action.input.changeToEConsult }
  );
  let details = null;
  let error = null;

  const response = await cxt.getOceanClientService().sendMessage({ message });
  if (response.status !== 200) {
    cxt.logger.warn(`Failed to toggle eConsult status: ${response.status}`);
    error = "Failed to toggle eConsult status";
  } else {
    details = "Toggled eConsult status";
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
