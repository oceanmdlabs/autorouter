import type { Identifier, Resource } from "fhir/r4";
import { z } from "zod";

export const tenantConfinedSchema = z.object({
  tenantId: z.string().nonempty(),
});

export type TenantConfined = z.infer<typeof tenantConfinedSchema>;

export function isTenantConfined(resource: unknown | TenantConfined): resource is TenantConfined {
  return (resource as {tenantId?: string}).tenantId !== undefined;
}

export const baseResourceSchema = z.object({
  id: z.string().nonempty(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nonempty(),
  updatedBy: z.string().nonempty(),
});
export const newBaseResourceSchema = baseResourceSchema
  .partial()
  .merge(tenantConfinedSchema.partial());

export type BaseResource = z.infer<typeof baseResourceSchema>;
export type NewBaseResource = z.infer<typeof newBaseResourceSchema>;
export type UpdateBaseResource = z.infer<typeof updateBaseResourceSchema>;

export const updateBaseResourceSchema = newBaseResourceSchema
  .merge(
    baseResourceSchema.pick({
      id: true,
    })
  )
  .merge(tenantConfinedSchema.partial());

export const fhirDataSchema = z.object({
  id: z.string().optional(),
  resourceType: z.string(),
  identifier: z.array(z.unknown()).optional(),
});
export type FhirData = {
  resourceType: string;
  id?: string;
  identifier?: Identifier[];
};
export type WithFhirContent<T, F extends Resource> = Omit<T, "content"> & {
  content: F;
};
