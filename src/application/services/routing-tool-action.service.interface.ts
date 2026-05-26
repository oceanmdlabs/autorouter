import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { RoutingEventContext } from "@/src/entities/models/routing-event-context";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export interface IRoutingToolActionService {
  executeActions(
    actions: RoutingToolAction<RoutingToolName>[],
    routingEventContext: RoutingEventContext,
    ruleName?: string
  ): Promise<Map<string, string>>;
}
