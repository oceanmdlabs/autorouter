import type { RoutingToolAction, ToolExecutionResult } from "@/src/entities/models/routing-tool";
import type { RoutingEventContext } from "@/src/entities/models/routing-event-context";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

export async function commentHandler(
  action: RoutingToolAction<"comment">,
  eventContext: RoutingEventContext,
  cxt: ApplicationContext
): Promise<ToolExecutionResult> {
  const { comment } = action.input;

  await cxt.getActivityLogEntriesRepository().create({
    details: comment
  });

  const logDetails: LogToolEvent = {
    event: "tool.execution.success",
    message: "Comment added successfully",
    tool: "comment",
    timestamp: new Date().toISOString(),
    referralRef: getReferralRef(eventContext),
    actionId: action.id
  };
  cxt.logger.info(logDetails);


  return {
    tool: "comment",
    success: true,
    routingEventContext: eventContext
  };
}
