import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";
import { siteConfigurationSchema } from "./site-configuration";

const erequestBlobKindEnum = z.enum(["primary_pdf", "attachment", "other"]);
const erequestBlobDownloadStatusEnum = z.enum(["pending", "stored", "failed"]);

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  erequestId: z.string().uuid(),
  kind: erequestBlobKindEnum,
  filename: z.string().min(1),
  contentType: z.string().nullable().optional(),
  byteSize: z.number().int().nonnegative(),
  checksumSha256: z.string().min(1),
  storageProvider: siteConfigurationSchema.shape.erequestStorageProvider,
  storageBucket: z.string().nullable().optional(),
  storageKey: z.string().min(1),
  sourceUrl: z.string().nullable().optional(),
  downloadStatus: erequestBlobDownloadStatusEnum,
  downloadError: z.string().nullable().optional(),
});

export const erequestBlobSchema = schema;
export const newErequestBlobSchema = schema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    updatedBy: true,
  })
  .merge(newBaseResourceSchema)
  .merge(tenantConfinedSchema.partial());
export const updateErequestBlobSchema = schema.partial().merge(
  updateBaseResourceSchema
);

export type ErequestBlob = z.infer<typeof erequestBlobSchema>;
export type NewErequestBlob = z.infer<typeof newErequestBlobSchema>;
export type UpdateErequestBlob = z.infer<typeof updateErequestBlobSchema>;
export type ErequestBlobKind = z.infer<typeof erequestBlobKindEnum>;
export type ErequestBlobDownloadStatus = z.infer<
  typeof erequestBlobDownloadStatusEnum
>;
