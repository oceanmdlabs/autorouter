import type { Identifier } from "fhir/r4";
import { z } from "zod";

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

export const selectBaseResourceSchema = z.object({
  id: z.string(),
  createdAt: z.date().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
  content: fhirDataSchema,
});
export type BaseResource = z.infer<typeof selectBaseResourceSchema>;

export const insertBaseResourceSchema = z.object({
  id: z.string().optional(),
  content: fhirDataSchema,
});
