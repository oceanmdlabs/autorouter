import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";
import { routingEventTypeSchema } from "./routing-event-type";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  name: z.string(),
  triggeringEvent: routingEventTypeSchema,
  prompt: z.string(),
  active: z.boolean().default(true),
  enabledTools: z.array(z.string() as z.ZodType<RoutingToolName>).default([]),
});
const newSchema = schema.merge(newBaseResourceSchema);
const updateSchema = schema.merge(updateBaseResourceSchema);

export const routingRuleSchema = schema;
export const newRoutingRuleSchema = newSchema;
export const updateRoutingRuleSchema = updateSchema;
export type RoutingRule = z.infer<typeof schema>;
export type NewRoutingRule = z.infer<typeof newSchema>;
export type UpdateRoutingRule = z.infer<typeof updateSchema>;
