import { createSendCommunicationMessage } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "markAsNeedsReview";

export const markAsNeedsReviewHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const message = createSendCommunicationMessage(
    eventContext.serviceRequestBundle,
    {
      message: "Autorouter marked as needing review: " + action.input.message,
    }
  );
  let details = null;
  let error = null;

  const response = await cxt.getOceanClientService().sendMessage({
    message,
    version: "v12",
  });
  if (response.status !== 200) {
    cxt.logger.warn(
      `Failed to send communication to provider (to mark as needing review): ${response.status}`
    );
    error =
      "Failed to send communication to provider (to mark as needing review)";
  } else {
    details = `Marked as needing review: "${action.input.message}"`;
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
