import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  name: z.string(),
  oceanReference: z
    .string()
    .regex(/^\S+$/, "The Ocean Listing Reference cannot contain spaces.")
    .refine(
      (val) => !/rtRef/i.test(val) && !/=/.test(val),
      "The Ocean Listing Reference cannot contain 'rtRef' or '='."
    ),
  description: z.string(),
});
const newSchema = schema.merge(newBaseResourceSchema);
const updateSchema = schema.merge(updateBaseResourceSchema);

export const healthcareServiceSchema = schema;
export const newHealthcareServiceSchema = newSchema;
export const updateHealthcareServiceSchema = updateSchema;
export type HealthcareService = z.infer<typeof schema>;
export type NewHealthcareService = z.infer<typeof newSchema>;
export type UpdateHealthcareService = z.infer<typeof updateSchema>;
