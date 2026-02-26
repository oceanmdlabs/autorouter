import { uuid } from "@/src/entities/models/uuid";
import type { Bundle } from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { ISiteConfigurationRepository } from "@/src/application/repositories/site-configuration.repository.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { Smtp2goEmailService } from "@/src/infrastructure/services/email/smtp2go-email-service";
import { sendEmailHandler } from "../send-email-handler";

vi.mock("@/src/infrastructure/services/email/smtp2go-email-service");

const DEPLOY_URL = "http://localhost:4000";
process.env.DEPLOY_URL = DEPLOY_URL;

class TestApplicationContext extends ApplicationContext {
  constructor(
    public activityLogRepo: IActivityLogEntriesRepository,
    public siteConfigRepo: ISiteConfigurationRepository
  ) {
    super({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
    });
  }

  override getActivityLogEntriesRepository(): IActivityLogEntriesRepository {
    return this.activityLogRepo;
  }

  override getSiteConfigurationRepository(): ISiteConfigurationRepository {
    return this.siteConfigRepo;
  }
}

describe("sendEmailHandler", () => {
  let cxt: TestApplicationContext;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let mockSiteConfigRepo: ISiteConfigurationRepository;
  let mockSendEmail = vi.fn();

  beforeEach(() => {
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
      update: vi.fn(),
      getAll: vi.fn(),
      findByClientId: vi.fn(),
      create: vi.fn(),
    };

    cxt = new TestApplicationContext(mockActivityLogRepo, mockSiteConfigRepo);
    mockSendEmail = vi.fn();
    (Smtp2goEmailService as any).prototype.sendTemplatedEmail = mockSendEmail;
  });

  it("should send an email with the correct HTML body and log the action", async () => {
    const action: RoutingToolAction<"sendEmail"> = {
      id: uuid().toString(),
      tool: "sendEmail",
      input: {
        to: "test@example.com",
        subject: "Test Subject",
        message: "This is a test message.",
      },
    };
    const eventContext = {
      resourceId: "123",
      tenantId: "test-tenant",
      traceId: "trace-123",
      triggeringEvent: "request_received" as const,
      serviceRequestBundle: {} as Bundle,
    };

    const siteConfig: Partial<SiteConfiguration> = {
      emailProvider: "smtp2go",
      emailFromAddress: "noreply@example.com",
      emailApiKey: "test-api-key",
    };
    (mockSiteConfigRepo.getForTenant as any).mockResolvedValue(siteConfig);

    await sendEmailHandler(action, eventContext, cxt);

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailPayload = mockSendEmail.mock.calls[0]?.[0];

    expect(emailPayload.to).toBe("test@example.com");
    expect(emailPayload.subject).toBe("Test Subject");
    expect(emailPayload.message).toBe("This is a test message.");

    expect(mockActivityLogRepo.create).toHaveBeenCalledOnce();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith({
      ...eventContext,
      tool: "sendEmail",
      details: 'Sent email to test@example.com: "Test Subject"',
    });
  });
});
