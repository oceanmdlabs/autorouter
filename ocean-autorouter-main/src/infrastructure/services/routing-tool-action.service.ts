import type { IRoutingToolActionService } from "@/src/application/services/routing-tool-action.service.interface";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { InvalidArgumentsError } from "@/src/entities/errors/common";
import type { RoutingToolAction, ToolExecutionResult } from "@/src/entities/models/routing-tool";
import type { RoutingEventContext } from "@/src/entities/models/routing-event-context";
import { type RoutingToolName, routingToolRegistry } from "./routing-tools/routing-tool-registry";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createRoutingToolActionService = (
  deps: Dependencies
): IRoutingToolActionService => {
  const { cxt } = deps;

  async function executeActions(
    actions: RoutingToolAction<RoutingToolName>[],
    eventContext: RoutingEventContext
  ) {
    for (const action of actions) {
      await executeAction(action, eventContext);
    }
  }

  async function executeAction(
    action: RoutingToolAction<RoutingToolName>,
    eventContext: RoutingEventContext
  ): Promise<void> {

    const includeInput = cxt.logger.level === "debug";
    const inputPart = includeInput ? ` ${JSON.stringify(action.input)}` : "";

    cxt.logger.info(
      `Executing routing tool action with id ${action.id}: ${action.tool}${inputPart}`
    );

    const tool = routingToolRegistry[action.tool];
    if (!tool) {
      throw new InvalidArgumentsError(
        `Unsupported action tool: ${action.tool}`
      );
    }

    const handler = tool.handler as (
      action: RoutingToolAction<RoutingToolName>,
      eventContext: RoutingEventContext,
      cxt: ApplicationContext) => Promise<ToolExecutionResult>;
    try {
      const result = await handler(action, eventContext, cxt);

      await cxt.getActivityLogEntriesRepository().create({
        ...eventContext,
        tool: result.tool,
        error: result.error
      });

    } catch (e) {
      cxt.logger.error(e);
    }
  }

  return {
    executeActions
  };
};
