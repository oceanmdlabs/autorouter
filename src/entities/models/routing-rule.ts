import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";
import { routingEventTypeSchema } from "./routing-event-type";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export const allowedContextFieldValues = ["age", "gender", "postalCode", "attachments"] as const;
export type AllowedContextField = typeof allowedContextFieldValues[number];

function requireSummarizeAcknowledgement(
  data: { allowedContextFields?: string[]; summarizeAttachmentsAcknowledged?: boolean },
  ctx: z.RefinementCtx
) {
  if (data.allowedContextFields?.includes("attachments") && !data.summarizeAttachmentsAcknowledged) {
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
  allowedContextFields: z.array(z.enum(allowedContextFieldValues)).default([]),
  priority: z.number().int().positive(),
  stopProcessingOnMatch: z.boolean().default(false),
});

const schema = baseFields.superRefine(requireSummarizeAcknowledgement);
const newSchema = baseFields
  .merge(newBaseResourceSchema)
  .extend({ priority: z.number().int().positive().optional() })
  .superRefine(requireSummarizeAcknowledgement);
const updateSchema = baseFields
  .merge(updateBaseResourceSchema)
  .extend({ priority: z.number().int().positive().optional() })
  .superRefine(requireSummarizeAcknowledgement);

export const routingRuleSchema = schema;
export const newRoutingRuleSchema = newSchema;
export const updateRoutingRuleSchema = updateSchema;
export type RoutingRule = z.infer<typeof schema>;
export type NewRoutingRule = z.infer<typeof newSchema>;
export type UpdateRoutingRule = z.infer<typeof updateSchema>;
