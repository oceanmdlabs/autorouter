import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { ISiteConfigurationRepository } from "@/src/application/repositories/site-configuration.repository.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { uuid } from "@/src/entities/models/uuid";
import type { Bundle } from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/infrastructure/services/sms/twilio-sms-service");
vi.mock("@/src/infrastructure/services/sms/aws-sms-service");

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
    smsProvider: "twilio",
    twilioAccountSid: "AC123",
    twilioAuthToken: "auth-token",
    twilioPhoneNumber: "+16135550100",
    smsSendAllowlist: [{ phoneNumber: "+16135551234" }], // allowlist baseAction's default target
    ...overrides,
  } as SiteConfiguration;
}

const baseAction: RoutingToolAction<"sendSms"> = {
  id: uuid().toString(),
  tool: "sendSms",
  input: { message: "Test message", phoneNumber: "+16135551234" },
};

const eventContext = {
  triggeringEvent: "request_received" as const,
  serviceRequestBundle: {} as Bundle,
};

describe("sendSmsHandler", () => {
  let cxt: TestApplicationContext;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let mockSiteConfigRepo: ISiteConfigurationRepository;
  let mockTwilioSendSms: ReturnType<typeof vi.fn>;
  let mockAwsSendSms: ReturnType<typeof vi.fn>;

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

    mockTwilioSendSms = vi.fn().mockResolvedValue(undefined);
    mockAwsSendSms = vi.fn().mockResolvedValue(undefined);

    const { TwilioSmsService } = await import(
      "@/src/infrastructure/services/sms/twilio-sms-service"
    );
    const { AwsSmsService } = await import(
      "@/src/infrastructure/services/sms/aws-sms-service"
    );
    (TwilioSmsService as any).prototype.sendSms = mockTwilioSendSms;
    (AwsSmsService as any).prototype.sendSms = mockAwsSendSms;
  });

  it("sends via Twilio when smsProvider is twilio", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "twilio" })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockTwilioSendSms).toHaveBeenCalledOnce();
    expect(mockAwsSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining("Sent SMS") })
    );
  });

  it("sends via AWS when smsProvider is aws", async () => {
    process.env.AWS_REGION = "ca-central-1";
    process.env.SMS_ORIGINATION_NUMBER = "+16135550100";
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "aws" })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockAwsSendSms).toHaveBeenCalledOnce();
    expect(mockTwilioSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining("Sent SMS") })
    );
  });

  it("blocks non-Canadian phone numbers", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "twilio" })
    );
    const action: RoutingToolAction<"sendSms"> = {
      ...baseAction,
      input: { message: "Test", phoneNumber: "+12125551234" }, // NYC area code
    };
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(action, eventContext, cxt);

    expect(mockTwilioSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("not a Canadian phone number"),
      })
    );
  });

  it("blocks sends when no provider configured", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: null })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockTwilioSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("SMS provider is not configured"),
      })
    );
  });

  it("enforces daily SMS limit", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "twilio", smsDailySentCount: 1000, smsDailySentDate: today })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockTwilioSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Daily SMS limit"),
      })
    );
  });

  it("blocks sends when allowlist is null (not configured)", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "twilio", smsSendAllowlist: null })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockTwilioSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("no approved phone numbers") })
    );
  });

  it("blocks sends when allowlist is empty", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "twilio", smsSendAllowlist: [] })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockTwilioSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("no approved phone numbers") })
    );
  });

  it("blocks sends when recipient is not in the allowlist", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        smsProvider: "twilio",
        smsSendAllowlist: [{ phoneNumber: "+16135550001", label: "Other number" }],
      })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt); // baseAction targets +16135551234

    expect(mockTwilioSendSms).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("not in the approved phone number allowlist") })
    );
  });

  it("allows sends when recipient is in the allowlist (E.164)", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        smsProvider: "twilio",
        smsSendAllowlist: [{ phoneNumber: "+16135551234", label: "Test number" }],
      })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockTwilioSendSms).toHaveBeenCalledOnce();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining("Sent SMS") })
    );
  });

  it("normalizes allowlist entries for comparison (10-digit stored, E.164 incoming)", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        smsProvider: "twilio",
        smsSendAllowlist: [{ phoneNumber: "6135551234" }], // stored without +1
      })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt); // baseAction is +16135551234

    expect(mockTwilioSendSms).toHaveBeenCalledOnce();
  });

  it("normalizes allowlist entries for comparison (E.164 stored, 10-digit incoming)", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({
        smsProvider: "twilio",
        smsSendAllowlist: [{ phoneNumber: "+16135551234" }],
      })
    );
    const action: RoutingToolAction<"sendSms"> = {
      ...baseAction,
      input: { message: "Test", phoneNumber: "6135551234" }, // 10-digit local format
    };
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(action, eventContext, cxt);

    expect(mockTwilioSendSms).toHaveBeenCalledOnce();
  });

  it("increments daily SMS count on successful send", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "twilio", smsDailySentCount: 5, smsDailySentDate: today })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    expect(mockSiteConfigRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ smsDailySentCount: 6, smsDailySentDate: today })
    );
  });

  it("resets daily count when date changes", async () => {
    vi.mocked(mockSiteConfigRepo.getForTenant).mockResolvedValue(
      makeSiteConfig({ smsProvider: "twilio", smsDailySentCount: 999, smsDailySentDate: "2020-01-01" })
    );
    const { sendSmsHandler } = await import("../send-sms-handler");
    await sendSmsHandler(baseAction, eventContext, cxt);

    const today = new Date().toISOString().slice(0, 10);
    expect(mockSiteConfigRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ smsDailySentCount: 1, smsDailySentDate: today })
    );
  });
});
