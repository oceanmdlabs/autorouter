import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";

import type { Patient as FhirPatient } from "fhir/r4";

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  content: z
    .object({
      resourceType: z.literal("Patient"),
    })
    .passthrough(),
});
const newSchema = schema.merge(newBaseResourceSchema);
const updateSchema = schema.merge(updateBaseResourceSchema);

export const patientSchema = schema;
export const newPatientSchema = newSchema;
export const updatePatientSchema = updateSchema;
export type Patient = Omit<z.infer<typeof schema>, "content"> & {
  content: FhirPatient;
};
export type NewPatient = Omit<z.infer<typeof newSchema>, "content"> & {
  content: FhirPatient;
};
export type UpdatePatient = Omit<z.infer<typeof updateSchema>, "content"> & {
  content: FhirPatient;
};
