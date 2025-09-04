import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";
import type { ApplicationContext } from "@/src/entities/models/application-context";

export async function commentHandler(
  action: RoutingToolAction<"comment">,
  eventContext: ServiceRequestEventContext,
  cxt: ApplicationContext
): Promise<void> {
  const { comment } = action.input;

  await cxt.getActivityLogEntriesRepository().create({
    details: comment,
  });
}
