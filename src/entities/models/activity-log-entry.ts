import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";
import { routingEventTypeSchema } from "./routing-event-type";

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  triggeringEvent: routingEventTypeSchema.nullable().optional(),
  referralRef: z.string().nullable().optional(),
  requestingProvider: z.string().nullable().optional(),
  requestedListingTitle: z.string().nullable().optional(),
  requestedListingRef: z.string().nullable().optional(),
  requestedServiceDescription: z.string().nullable().optional(),
  tool: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
});

const newSchema = schema.merge(newBaseResourceSchema);
const updateSchema = schema.merge(updateBaseResourceSchema);

export const activityLogEntrySchema = schema;
export const newActivityLogEntrySchema = newSchema;
export const updateActivityLogEntrySchema = updateSchema;
export type ActivityLogEntry = z.infer<typeof schema>;
export type NewActivityLogEntry = z.infer<typeof newSchema>;
export type UpdateActivityLogEntry = z.infer<typeof updateSchema>;
