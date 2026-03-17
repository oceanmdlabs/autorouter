import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";

const erequestStorageStatusEnum = z.enum([
  "pending",
  "stored",
  "partial_failure",
  "failed",
]);

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  sourceMessageId: z.string().nullable().optional(),
  messageChecksum: z.string().min(1),
  referralRef: z.string().nullable().optional(),
  triggeringEvent: z.string().min(1),
  receivedAt: z.date(),
  patientHealthNumber: z.string().nullable().optional(),
  patientMedicalRecordNumber: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  patientFamilyName: z.string().nullable().optional(),
  patientGivenNames: z.string().nullable().optional(),
  patientDateOfBirth: z.date().nullable().optional(),
  referringProvider: z.string().nullable().optional(),
  receivingProvider: z.string().nullable().optional(),
  requestedListingRef: z.string().nullable().optional(),
  requestedListingTitle: z.string().nullable().optional(),
  healthServiceTypes: z.array(z.string()).default([]),
  requestedServiceDescription: z.string().nullable().optional(),
  rawBundle: z.unknown().nullable().optional(),
  primaryBlobId: z.string().uuid().nullable().optional(),
  storageStatus: erequestStorageStatusEnum,
  ingestionError: z.string().nullable().optional(),
});

export const erequestSchema = schema;
export const newErequestSchema = schema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    updatedBy: true,
  })
  .merge(newBaseResourceSchema)
  .merge(tenantConfinedSchema.partial());
export const updateErequestSchema = schema
  .partial()
  .merge(updateBaseResourceSchema);

export type Erequest = z.infer<typeof erequestSchema>;
export type NewErequest = z.infer<typeof newErequestSchema>;
export type UpdateErequest = z.infer<typeof updateErequestSchema>;

export type ErequestStorageStatus = z.infer<typeof erequestStorageStatusEnum>;
export type ErequestStorageProvider = "filesystem" | "s3";

export type ErequestSearchOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  healthNumber?: string;
  medicalRecordNumber?: string;
  patientName?: string;
  referringProvider?: string;
  receivingProvider?: string;
  referralRef?: string;
  requestedListing?: string;
  healthServiceType?: string;
  receivedFrom?: Date;
};
