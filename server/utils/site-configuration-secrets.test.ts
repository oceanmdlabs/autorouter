import { describe, expect, it } from "vitest";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import {
  SECRET_MASK_CHARACTER,
  maskSiteConfigurationSecrets,
  preserveMaskedSiteConfigurationSecrets,
  resolveMaskedSecretForUpdate,
} from "./site-configuration-secrets";

function createSiteConfiguration(
  overrides: Partial<SiteConfiguration> = {},
): SiteConfiguration {
  return {
    id: "site-config-id",
    tenantId: "tenant-1",
    name: "Tenant One",
    clientId: "client-id-1234567890",
    clientSecret: "client-secret-1234567890",
    oceanServer: "ocean",
    oceanSiteNum: "1234",
    oceanClientId: "ocean-client-id-12345678901234567890123456789012",
    oceanClientSecret:
      "ocean-client-secret-12345678901234567890123456789012",
    lastSuccessfulConnection: null,
    twilioAccountSid: "AC123",
    twilioAuthToken: "twilio-auth-token",
    twilioPhoneNumber: "+15551234567",
    aiProvider: "openai",
    aiApiKey: "ai-api-key",
    aiModel: "gpt-5.4",
    emailProvider: "smtp2go",
    emailFromAddress: "noreply@example.com",
    emailFromName: "Ocean Autorouter",
    emailApiKey: "email-api-key",
    siteKey: "site-key",
    siteCredential: "site-credential",
    sharedEncryptionKey: "shared-encryption-key",
    webhookKey: "webhook-key",
    webhookUnsignedChallengeUntil: null,
    erequestArchivalEnabled: false,
    erequestEnabledConfirmedAt: null,
    erequestDisabledConfirmedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

describe("site configuration secret masking", () => {
  it("masks secret fields in the GET response without changing length", () => {
    const siteConfig = createSiteConfiguration();

    const masked = maskSiteConfigurationSecrets(siteConfig);

    expect(masked?.clientSecret).toBe(
      SECRET_MASK_CHARACTER.repeat(siteConfig.clientSecret.length),
    );
    expect(masked?.oceanClientSecret).toBe(
      SECRET_MASK_CHARACTER.repeat(siteConfig.oceanClientSecret.length),
    );
    expect(masked?.aiApiKey).toBe(
      SECRET_MASK_CHARACTER.repeat(siteConfig.aiApiKey!.length),
    );
    expect(masked?.siteCredential).toBe(
      SECRET_MASK_CHARACTER.repeat(siteConfig.siteCredential!.length),
    );
  });

  it("preserves existing secrets when the masked placeholder is posted back", () => {
    const existingConfig = createSiteConfiguration();

    const normalized = preserveMaskedSiteConfigurationSecrets(
      {
        id: existingConfig.id,
        clientSecret: SECRET_MASK_CHARACTER.repeat(
          existingConfig.clientSecret.length,
        ),
        oceanClientSecret: SECRET_MASK_CHARACTER.repeat(
          existingConfig.oceanClientSecret.length,
        ),
        aiApiKey: SECRET_MASK_CHARACTER.repeat(existingConfig.aiApiKey!.length),
        emailApiKey: "",
      },
      existingConfig,
    );

    expect(normalized).not.toHaveProperty("clientSecret");
    expect(normalized).not.toHaveProperty("oceanClientSecret");
    expect(normalized).not.toHaveProperty("aiApiKey");
    expect(normalized.emailApiKey).toBe("");
  });

  it("restores the stored Ocean secret for connection tests when given a mask", () => {
    const existingSecret = "ocean-client-secret-123";

    expect(
      resolveMaskedSecretForUpdate(
        SECRET_MASK_CHARACTER.repeat(existingSecret.length),
        existingSecret,
      ),
    ).toBe(existingSecret);
  });
});
