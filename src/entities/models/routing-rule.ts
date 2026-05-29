import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";
import { routingEventTypeSchema } from "./routing-event-type";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

function requireSummarizeAcknowledgement(
  data: { enabledTools?: string[]; summarizeAttachmentsAcknowledged?: boolean },
  ctx: z.RefinementCtx
) {
  if (data.enabledTools?.includes("summarizeAttachments") && !data.summarizeAttachmentsAcknowledged) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "You must acknowledge the privacy warning before enabling attachment summarization.",
      path: ["summarizeAttachmentsAcknowledged"],
    });
  }
}

const baseFields = baseResourceSchema.merge(tenantConfinedSchema).extend({
  name: z.string(),
  triggeringEvent: routingEventTypeSchema,
  prompt: z.string(),
  active: z.boolean().default(true),
  enabledTools: z.array(z.string() as z.ZodType<RoutingToolName>).default([]),
  summarizeAttachmentsAcknowledged: z.boolean().default(false),
});

const schema = baseFields.superRefine(requireSummarizeAcknowledgement);
const newSchema = baseFields.merge(newBaseResourceSchema).superRefine(requireSummarizeAcknowledgement);
const updateSchema = baseFields.merge(updateBaseResourceSchema).superRefine(requireSummarizeAcknowledgement);

export const routingRuleSchema = schema;
export const newRoutingRuleSchema = newSchema;
export const updateRoutingRuleSchema = updateSchema;
export type RoutingRule = z.infer<typeof schema>;
export type NewRoutingRule = z.infer<typeof newSchema>;
export type UpdateRoutingRule = z.infer<typeof updateSchema>;
