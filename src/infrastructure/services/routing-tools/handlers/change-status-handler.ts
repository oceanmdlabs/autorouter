import {
  createStatusChangeMessage,
  type TaskStatus,
} from "../../ocean-message.service";
import type {
  RoutingToolAction,
  RoutingToolHandler,
} from "@/src/entities/models/routing-tool";

const TOOL_NAME = "changeStatus";

export const changeStatusHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt
) => {
  let details = null;
  let error = null;

  const description = getDescriptionForStatusChange(action);
  const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
  if (!serviceRequestBundle) {
    error = "No service request bundle available";
  }
  else {
    const message = createStatusChangeMessage(serviceRequestBundle, {
    status: action.input.status as TaskStatus,
    reason: action.input.reason ?? "",
    description: description,
  });
  const response = await cxt.getOceanClientService().sendMessage({ message });
  if (response.status !== 200) {
    cxt.logger.warn(`Failed to accept service request: ${response.status}`);
    error = `Failed to ${action.input.status} service request`;
  } else {
      details = description;
    }
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
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
  }
}
