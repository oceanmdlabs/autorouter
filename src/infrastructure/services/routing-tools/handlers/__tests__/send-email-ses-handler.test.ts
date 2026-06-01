import fs from "fs";
import path from "path";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { ISiteConfigurationRepository } from "@/src/application/repositories/site-configuration.repository.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { uuid } from "@/src/entities/models/uuid";
import type { Bundle } from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DEPLOY_URL = "http://localhost:4000";

vi.mock("@/src/infrastructure/services/email/ses-email-service");
vi.mock("@/src/infrastructure/services/email/smtp2go-email-service");

class TestApplicationContext extends ApplicationContext {
  constructor(
    public activityLogRepo: IActivityLogEntriesRepository,
    public siteConfigRepo: ISiteConfigurationRepository
  ) {
    super({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn() });
  }

  override getActivityLogEntriesRepository(): IActivityLogEntriesRepository {
    return this.activityLogRepo;
  }

  override getSiteConfigurationRepository(): ISiteConfigurationRepository {
    return this.siteConfigRepo;
  }
}

function makeSiteConfig(overrides: Partial<SiteConfiguration> = {}): SiteConfiguration {
  return {
    id: "cfg-1",
    tenantId: "tenant-1",
    name: "Test Site",
    clientId: "client-id-1234567890",
    clientSecret: "secret-1234567890",
    oceanServer: "ocean",
    oceanSiteNum: "12345",
    oceanClientId: "",
    oceanClientSecret: "",
    emailProvider: "smtp2go",
    emailFromAddress: "no-reply@example.com",
    emailApiKey: "smtp2go-api-key",
    ...overrides,
  } as SiteConfiguration;
}

describe("sendEmailHandler — provider selection and daily limit", () => {
  let cxt: TestApplicationContext;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let mockSiteConfigRepo: ISiteConfigurationRepository;
  let mockSesTemplatedEmail: ReturnType<typeof vi.fn>;
  let mockSmtp2goTemplatedEmail: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockActivityLogRepo = {
      create: vi.fn(),
      getAllAtTenant: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      removeAll: vi.fn(),
    };

    mockSiteConfigRepo = {
      getForTenant: vi.fn(),
      getAll: vi.fn(),
      findByClientId: vi.fn(),
      recordSuccessfulConnection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    cxt = new TestApplicationContext(mockActivityLogRepo, mockSiteConfigRepo);

    mockSesTemplatedEmail = vi.fn().mockResolvedValue(undefined);
    mockSmtp2goTemplatedEmail = vi.fn().mockResolvedValue(undefined);

    const { SesEmailService } = await import(
      "@/src/infrastructure/services/email/ses-email-service"
    );
    const { Smtp2goEmailService } = await import(
      "@/src/infrastructure/services/email/smtp2go-email-service"
    );
    (SesEmailService as any).prototype.sendTemplatedEmail = mockSesTemplatedEmail;
    (Smtp2goEmailService as any).prototype.sendTemplatedEmail = mockSmtp2goTemplatedEmail;
  });

  const baseAction: RoutingToolAction<"sendEmail"> = {
    id: uuid().toString(),
    tool: "sendEmail",
    input: { to: "doc@example.com", subject: "Test", message: "Hello" },
  };

  const eventContext = {
    triggeringEvent: "request_received" as const,
    serviceRequestBundle: {} as Bundle,
  };

  it("uses SES provider when emailProvider is ses", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailProvider: "ses", emailApiKey: null })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(baseAction, eventContext, cxt);

    expect(mockSesTemplatedEmail).toHaveBeenCalledOnce();
    expect(mockSmtp2goTemplatedEmail).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining("Sent email") })
    );
  });

  it("uses SMTP2GO provider when emailProvider is smtp2go", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailProvider: "smtp2go" })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(baseAction, eventContext, cxt);

    expect(mockSmtp2goTemplatedEmail).toHaveBeenCalledOnce();
    expect(mockSesTemplatedEmail).not.toHaveBeenCalled();
  });

  it("rejects sending when smtp2go is configured but has no API key", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailProvider: "smtp2go", emailApiKey: null })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(baseAction, eventContext, cxt);

    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("not set up") })
    );
    expect(mockSiteConfigRepo.update).not.toHaveBeenCalled();
  });

  it("blocks sending when daily limit is reached", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        emailProvider: "ses",
        emailApiKey: null,
        emailDailySentCount: 1000,
        emailDailySentDate: today,
      })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(baseAction, eventContext, cxt);

    expect(mockSesTemplatedEmail).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Daily email limit") })
    );
    expect(mockSiteConfigRepo.update).not.toHaveBeenCalled();
  });

  it("resets daily count when emailDailySentDate is a previous day", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        emailProvider: "ses",
        emailApiKey: null,
        emailDailySentCount: 999,
        emailDailySentDate: "2020-01-01",
      })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(baseAction, eventContext, cxt);

    expect(mockSiteConfigRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ emailDailySentCount: 1 })
    );
  });

  it("increments daily count after a successful send", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        emailProvider: "ses",
        emailApiKey: null,
        emailDailySentCount: 5,
        emailDailySentDate: today,
      })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(baseAction, eventContext, cxt);

    expect(mockSiteConfigRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ emailDailySentCount: 6, emailDailySentDate: today })
    );
  });
});
