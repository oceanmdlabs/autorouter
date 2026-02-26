import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { RoutingEventContext } from "@/src/entities/models/routing-event-context";
import type { ApplicationContext } from "@/src/entities/models/application-context";

export async function commentHandler(
  action: RoutingToolAction<"comment">,
  eventContext: RoutingEventContext,
  cxt: ApplicationContext
): Promise<void> {
  const { comment } = action.input;

  await cxt.getActivityLogEntriesRepository().create({
    details: comment,
  });
}
