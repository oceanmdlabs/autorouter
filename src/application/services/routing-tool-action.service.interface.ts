import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export interface IRoutingToolActionService {
  executeActions(
    actions: RoutingToolAction<RoutingToolName>[],
    serviceRequestEventContext: ServiceRequestEventContext
  ): Promise<void>;
}
