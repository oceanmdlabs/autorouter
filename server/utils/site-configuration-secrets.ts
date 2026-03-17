import type {
  SiteConfiguration,
  UpdateSiteConfiguration,
} from "@/src/entities/models/site-configuration";

export const SECRET_MASK_CHARACTER = "•";

export const siteConfigurationSecretFields = [
  "clientSecret",
  "oceanClientSecret",
  "twilioAuthToken",
  "aiApiKey",
  "emailApiKey",
  "siteKey",
  "siteCredential",
  "sharedEncryptionKey",
  "webhookKey",
] as const;

type SiteConfigurationSecretField =
  (typeof siteConfigurationSecretFields)[number];

type SiteConfigurationWithSecrets = Pick<
  SiteConfiguration,
  SiteConfigurationSecretField
>;

export function maskSecret(secret: string): string {
  return SECRET_MASK_CHARACTER.repeat(secret.length);
}

export function isMaskedSecretValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    [...value].every((character) => character === SECRET_MASK_CHARACTER)
  );
}

export function maskSiteConfigurationSecrets(
  siteConfig: SiteConfiguration | null,
): SiteConfiguration | null {
  if (!siteConfig) {
    return null;
  }

  return {
    ...siteConfig,
    ...getMaskedSecretFields(siteConfig),
  };
}

export function preserveMaskedSiteConfigurationSecrets(
  body: Record<string, unknown>,
  existingConfig: SiteConfiguration | null,
): Record<string, unknown> {
  if (!existingConfig) {
    return body;
  }

  const normalizedBody = { ...body };
  for (const field of siteConfigurationSecretFields) {
    const incomingValue = normalizedBody[field];
    const existingValue = existingConfig[field];

    if (
      typeof incomingValue === "string" &&
      typeof existingValue === "string" &&
      existingValue.length > 0 &&
      incomingValue === maskSecret(existingValue)
    ) {
      delete normalizedBody[field];
    }
  }

  return normalizedBody;
}

export function resolveMaskedSecretForUpdate(
  value: unknown,
  existingValue: string | null | undefined,
): string | undefined {
  if (
    typeof value === "string" &&
    typeof existingValue === "string" &&
    existingValue.length > 0 &&
    value === maskSecret(existingValue)
  ) {
    return existingValue;
  }

  return typeof value === "string" ? value : undefined;
}

export function getMaskedSecretFields(
  siteConfig: SiteConfiguration | null,
): Partial<SiteConfigurationWithSecrets> {
  if (!siteConfig) {
    return {};
  }

  return Object.fromEntries(
    siteConfigurationSecretFields.flatMap((field) => {
      const value = siteConfig[field];
      return typeof value === "string" && value.length > 0
        ? [[field, maskSecret(value)]]
        : [];
    }),
  ) as Partial<SiteConfigurationWithSecrets>;
}

export function preserveMaskedSecretsInUpdate(
  update: UpdateSiteConfiguration,
  existingConfig: SiteConfiguration | null,
): UpdateSiteConfiguration {
  return preserveMaskedSiteConfigurationSecrets(
    update,
    existingConfig,
  ) as UpdateSiteConfiguration;
}
