import { z } from "zod";
import type { ApplicationContext } from "./application-context";
import type { RoutingEventContext } from "./routing-event-context";
import { clientRoutingToolRegistry } from "./routing-tool-client";
import type {
  RoutingToolName,
  RoutingToolRegistry,
} from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export type DryRunPayload = {
  payloadType: "ocean-fhir-message" | "email" | "sms" | "internal" | "cds-card";
  summary: string;
  payload: Record<string, unknown>;
  error?: string;
};

export type RoutingToolAction<T extends RoutingToolName> = {
  id: string;
  tool: T;
  input: z.infer<RoutingToolRegistry[T]["input"]>;
  dryRunPayload?: DryRunPayload;
};

export type RoutingToolHandler<T extends RoutingToolName> = (
  action: RoutingToolAction<T>,
  eventContext: RoutingEventContext,
  cxt: ApplicationContext,
  ruleName?: string
) => Promise<string | void>;

export type RoutingToolDryRunner<T extends RoutingToolName> = (
  action: RoutingToolAction<T>,
  eventContext: RoutingEventContext,
  cxt: ApplicationContext
) => Promise<DryRunPayload>;

export type RoutingToolDefinition<
  T extends RoutingToolName,
  P extends z.ZodType
> = {
  name: T;
  input: P;
  handler?: RoutingToolHandler<T>;
  dryRun?: RoutingToolDryRunner<T>;
  supportsCdsHook?: boolean;
  description: string;
  briefDescription?: string;
};

export function getRoutingToolActionDescription(
  action: RoutingToolAction<RoutingToolName>
): string {
  const tool = clientRoutingToolRegistry[action.tool];
  return `${tool.briefDescription ?? tool.description} ${
    Object.keys(action.input).length > 0
      ? `(${JSON.stringify(action.input)})`
      : ""
  }`;
}
