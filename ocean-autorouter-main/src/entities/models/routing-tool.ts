import { z } from "zod";
import type { ApplicationContext } from "./application-context";
import type { RoutingEventContext } from "./routing-event-context";
import {
  routingToolRegistry,
  type RoutingToolName,
  type RoutingToolRegistry,
} from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export type ToolExecutionResult = {
  tool: string;
  success: boolean;
  error?: string | null;
  routingEventContext: RoutingEventContext
};


export type RoutingToolAction<T extends RoutingToolName> = {
  id: string;
  tool: T;
  input: z.infer<RoutingToolRegistry[T]["input"]>;
};

export type RoutingToolHandler<T extends RoutingToolName> = (
  action: RoutingToolAction<T>,
  eventContext: RoutingEventContext,
  cxt: ApplicationContext
) => Promise<ToolExecutionResult>;

export type RoutingToolDefinition<
  T extends RoutingToolName,
  P extends z.ZodType
> = {
  name: T;
  displayName: string;
  input: P;
  handler?: RoutingToolHandler<T>;
  supportsCdsHook?: boolean;
  description: string;
  briefDescription?: string;
};

export function getRoutingToolActionDescription(
  action: RoutingToolAction<RoutingToolName>
): string {
  const tool =
    routingToolRegistry[action.tool as keyof typeof routingToolRegistry];
  return `${tool.briefDescription ?? tool.description} ${
    Object.keys(action.input).length > 0
      ? `(${JSON.stringify(action.input)})`
      : ""
  }`;
}

/**
 * Get the display name for a tool from the registry
 * Returns the toolName if not found in registry
 */
export function getToolDisplayName(toolName: string): string {
  const tool = routingToolRegistry[toolName as keyof typeof routingToolRegistry];
  return tool?.displayName ?? toolName;
}

