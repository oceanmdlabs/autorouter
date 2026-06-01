import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
  updateBaseResourceSchema,
} from "./base";

const OceanServerEnum = z.enum(["ocean", "test", "staging", "local"]);
export type OceanServer = z.infer<typeof OceanServerEnum>;

const AiProviderEnum = z.enum(["openai", "google", "cohere", "bedrock"]);
export type AiProvider = z.infer<typeof AiProviderEnum>;

const EmailProviderEnum = z.enum(["smtp2go", "ses"]);
export type EmailProvider = z.infer<typeof EmailProviderEnum>;

const schema = baseResourceSchema.merge(tenantConfinedSchema).extend({
  name: z
    .string()
    .nonempty(
      "Your site name is required. You can use the name of your Ocean site.",
    )
    .max(255),
  clientId: z.string().trim().nonempty().min(10).max(255),
  clientSecret: z.string().trim().nonempty().min(10).max(255),
  oceanServer: OceanServerEnum,
  oceanSiteNum: z
    .string()
    .trim()
    .nonempty("Ocean Site Number is required")
    .regex(/^\d{4,7}$/, "Must be a 4-7 digit number"),
  oceanClientId: z.union([
    z
      .string()
      .trim()
      .min(32, "Ocean Client IDs are at least 32 characters")
      .max(255),
    z.string().length(0),
  ]),
  oceanClientSecret: z.union([
    z
      .string()
      .trim()
      .min(32, "Ocean Client Secrets are at least 32 characters")
      .max(255),
    z.string().length(0),
  ]),
  lastSuccessfulConnection: z.coerce.date().nullable().optional(),
  twilioAccountSid: z.string().trim().max(255).optional().nullable(),
  twilioAuthToken: z.string().trim().max(255).optional().nullable(),
  twilioPhoneNumber: z.string().trim().max(255).optional().nullable(),
  aiProvider: AiProviderEnum.optional().nullable(),
  aiApiKey: z.string().trim().max(255).optional().nullable(),
  aiModel: z.string().trim().max(255).optional().nullable(),
  emailProvider: EmailProviderEnum.optional().nullable(),
  emailFromAddress: z
    .string()
    .email("Invalid email address")
    .optional()
    .nullable(),
  emailFromName: z.string().trim().max(255).optional().nullable(),
  emailApiKey: z.string().trim().max(255).optional().nullable(),
  emailDailySentCount: z.number().int().nonnegative().optional().nullable(),
  emailDailySentDate: z.string().optional().nullable(),
  emailSendAllowlist: z.array(z.string().email()).optional().nullable(),
  // Open API Credentials - Optional connection for Ocean patient engagement
  siteKey: z.string().trim().max(255).optional().nullable(),
  siteCredential: z.string().trim().max(255).optional().nullable(),
  sharedEncryptionKey: z.string().trim().max(255).optional().nullable(),
  webhookKey: z.string().trim().max(255).optional().nullable(),
  webhookUnsignedChallengeUntil: z.coerce.date().nullable().optional(),
  erequestArchivalEnabled: z.boolean().default(false),
  erequestEnabledConfirmedAt: z.coerce.date().nullable().optional(),
  erequestDisabledConfirmedAt: z.coerce.date().nullable().optional(),
});
const newSchema = schema.merge(newBaseResourceSchema);
const updateSchema = schema.partial().merge(updateBaseResourceSchema);

export const siteConfigurationReferenceSchema = schema.pick({
  id: true,
  name: true,
  tenantId: true,
});
export type SiteConfigurationReference = z.infer<
  typeof siteConfigurationReferenceSchema
>;

export const siteConfigurationSchema = schema;
export const newSiteConfigurationSchema = newSchema;
export const updateSiteConfigurationSchema = updateSchema;
export type SiteConfiguration = z.infer<typeof schema>;
export type NewSiteConfiguration = z.infer<typeof newSchema>;
export type UpdateSiteConfiguration = z.infer<typeof updateSchema>;

export interface ISiteConfigurationRepository {
  get(id: string): Promise<SiteConfiguration | null>;
  getByTenantId(tenantId: string): Promise<SiteConfiguration | null>;
  create(config: NewSiteConfiguration): Promise<SiteConfiguration>;
  update(
    id: string,
    config: UpdateSiteConfiguration,
  ): Promise<SiteConfiguration>;
  delete(id: string): Promise<void>;
}
