import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
  type WithFhirContent,
} from "./base";
import type { Bundle, Resource } from "fhir/r4";

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  content: z
    .object({
      resourceType: z.literal("Bundle"),
    })
    .passthrough(),
});
const newSchema = schema.merge(newBaseResourceSchema);
const updateSchema = schema.merge(updateBaseResourceSchema);

export const testServiceRequestSchema = schema;
export const newTestServiceRequestSchema = newSchema;
export const updateTestServiceRequestSchema = updateSchema;
// type WithBundleContent<T extends z.ZodType> = WithFhirContent<
//   z.infer<T>,
//   Bundle
// >;
export type TestServiceRequest = WithFhirContent<
  z.infer<typeof schema>,
  Bundle
>;
export type NewTestServiceRequest = z.infer<typeof newSchema>;
export type UpdateTestServiceRequest = z.infer<typeof updateSchema>;
