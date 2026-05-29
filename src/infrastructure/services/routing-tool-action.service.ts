import type { IRoutingToolActionService } from "@/src/application/services/routing-tool-action.service.interface";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { InvalidArgumentsError } from "@/src/entities/errors/common";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { RoutingEventContext } from "@/src/entities/models/routing-event-context";
import {
  routingToolRegistry,
  type RoutingToolName,
} from "./routing-tools/routing-tool-registry";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createRoutingToolActionService = (
  deps: Dependencies
): IRoutingToolActionService => {
  const { cxt } = deps;

  async function executeActions(
    actions: RoutingToolAction<RoutingToolName>[],
    eventContext: RoutingEventContext,
    ruleName?: string
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    for (const action of actions) {
      const result = await executeAction(action, eventContext, ruleName);
      if (result) results.set(action.id, result);
    }
    return results;
  }

  async function executeAction(
    action: RoutingToolAction<RoutingToolName>,
    eventContext: RoutingEventContext,
    ruleName?: string
  ): Promise<string | undefined> {
    // Log the action being executed
    cxt.logger.info(
      `Executing routing tool action with id ${action.id}: ${
        action.tool
      } ${JSON.stringify(action.input)}`
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
      cxt: ApplicationContext,
      ruleName?: string
    ) => Promise<string | void>;
    try {
      const result = await handler(action, eventContext, cxt, ruleName);
      return result ?? undefined;
    } catch (e) {
      cxt.logger.error(e);
    }
  }

  return {
    executeActions,
  };
};
