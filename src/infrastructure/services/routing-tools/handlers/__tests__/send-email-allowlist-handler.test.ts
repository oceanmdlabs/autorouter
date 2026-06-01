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
    emailProvider: "ses",
    emailFromAddress: "no-reply@example.com",
    emailSendAllowlist: ["approved@example.com"],
    ...overrides,
  } as SiteConfiguration;
}

describe("sendEmailHandler — allowlist enforcement", () => {
  let cxt: TestApplicationContext;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let mockSiteConfigRepo: ISiteConfigurationRepository;
  let mockSendTemplatedEmail: ReturnType<typeof vi.fn>;

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

    mockSendTemplatedEmail = vi.fn().mockResolvedValue(undefined);
    const { SesEmailService } = await import(
      "@/src/infrastructure/services/email/ses-email-service"
    );
    (SesEmailService as any).prototype.sendTemplatedEmail = mockSendTemplatedEmail;
  });

  function action(to: string, cc?: string): RoutingToolAction<"sendEmail"> {
    return {
      id: uuid().toString(),
      tool: "sendEmail",
      input: { to, subject: "Subject", message: "Body", ...(cc ? { cc } : {}) },
    };
  }

  const eventContext = {
    triggeringEvent: "request_received" as const,
    serviceRequestBundle: {} as Bundle,
  };

  it("sends when To address is in the allowlist", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: ["approved@example.com"] })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(action("approved@example.com"), eventContext, cxt);

    expect(mockSendTemplatedEmail).toHaveBeenCalledOnce();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining("Sent email") })
    );
  });

  it("blocks when To address is not in the allowlist", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: ["approved@example.com"] })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(action("blocked@example.com"), eventContext, cxt);

    expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("not in approved allowlist") })
    );
  });

  it("blocks all sends when the allowlist is empty", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: [] })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(action("anyone@example.com"), eventContext, cxt);

    expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("allowlist is empty") })
    );
  });

  it("blocks all sends when the allowlist is null", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: null })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(action("anyone@example.com"), eventContext, cxt);

    expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("allowlist is empty") })
    );
  });

  it("enforces allowlist for multiple To recipients", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: ["a@example.com", "b@example.com"] })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(
      action("a@example.com, b@example.com"),
      eventContext,
      cxt
    );

    expect(mockSendTemplatedEmail).toHaveBeenCalledOnce();
  });

  it("blocks if any To recipient in a comma-separated list is not allowlisted", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: ["a@example.com"] })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(
      action("a@example.com, blocked@example.com"),
      eventContext,
      cxt
    );

    expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("blocked@example.com") })
    );
  });

  it("enforces allowlist for CC recipients", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: ["to@example.com"] })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(
      action("to@example.com", "cc@example.com"),
      eventContext,
      cxt
    );

    expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("cc@example.com") })
    );
  });

  it("allows send when both To and CC are allowlisted", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        emailSendAllowlist: ["to@example.com", "cc@example.com"],
      })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(
      action("to@example.com", "cc@example.com"),
      eventContext,
      cxt
    );

    expect(mockSendTemplatedEmail).toHaveBeenCalledOnce();
  });

  it("performs exact-match comparison (case-insensitive)", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ emailSendAllowlist: ["Doctor@Example.COM"] })
    );

    const { sendEmailHandler } = await import("../send-email-handler");
    await sendEmailHandler(action("doctor@example.com"), eventContext, cxt);

    expect(mockSendTemplatedEmail).toHaveBeenCalledOnce();
  });
});
