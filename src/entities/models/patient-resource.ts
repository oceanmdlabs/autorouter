import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";

import type { FhirData } from "./resource";

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  patientId: z.string(),
  content: z
    .object({
      resourceType: z.enum(["Condition", "Medication", "Observation"]),
    })
    .passthrough(),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
});
const newSchema = schema.merge(newBaseResourceSchema);
const updateSchema = schema.merge(updateBaseResourceSchema);

export const patientResourceSchema = schema;
export const newPatientResourceSchema = newSchema;
export const updatePatientResourceSchema = updateSchema;
export type PatientResource = Omit<z.infer<typeof schema>, "content"> & {
  content: FhirData;
};
export type NewPatientResource = z.infer<typeof newSchema>;
export type UpdatePatientResource = z.infer<typeof updateSchema>;
