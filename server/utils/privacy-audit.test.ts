import { describe, expect, it } from "vitest";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { summarizeSiteConfigurationChange } from "./privacy-audit";

function createSiteConfiguration(
  overrides: Partial<SiteConfiguration> = {}
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
    twilioAccountSid: null,
    twilioAuthToken: null,
    twilioPhoneNumber: null,
    aiProvider: "openai",
    aiApiKey: null,
    aiModel: "gpt-4.1",
    emailProvider: "smtp2go",
    emailFromAddress: "noreply@example.com",
    emailFromName: "Ocean Autorouter",
    emailApiKey: null,
    siteKey: null,
    siteCredential: null,
    sharedEncryptionKey: null,
    webhookKey: null,
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

describe("summarizeSiteConfigurationChange", () => {
  it("summarizes safe configuration categories instead of secret values", () => {
    const before = createSiteConfiguration();
    const after = createSiteConfiguration({
      aiApiKey: "new-secret-key",
      aiModel: "gpt-5.4",
      emailApiKey: "new-email-secret",
    });

    expect(
      summarizeSiteConfigurationChange({
        before,
        after,
      })
    ).toBe("Updated site configuration: AI settings, email settings.");
  });

  it("falls back to a generic summary when only unclassified fields changed", () => {
    const before = createSiteConfiguration();
    const after = createSiteConfiguration({
      lastSuccessfulConnection: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(
      summarizeSiteConfigurationChange({
        before,
        after,
      })
    ).toBe("Updated site configuration.");
  });
});
