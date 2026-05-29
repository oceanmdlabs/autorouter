import fs from "fs";
import path from "path";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { IRoutingRulesRepository } from "@/src/application/repositories/routing-rules.repository.interface";
import type { IOceanClientService } from "@/src/application/services/ocean-client.service.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { Bundle } from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/application/use-cases/archive-erequest.use-case", () => ({
  archiveErequestUseCase: vi.fn().mockResolvedValue({ message: "archived" }),
}));

vi.mock("@/src/application/use-cases/process-service-request-event.use-case", () => ({
  processServiceRequestEventUseCase: vi.fn().mockResolvedValue({ message: "processed" }),
}));

class TestApplicationContext extends ApplicationContext {
  constructor(
    public routingRulesRepo: IRoutingRulesRepository,
    public oceanClientSvc: IOceanClientService,
    public activityLogRepo: IActivityLogEntriesRepository
  ) {
    super({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
    });
  }

  override getRoutingRulesRepository(): IRoutingRulesRepository {
    return this.routingRulesRepo;
  }

  override getOceanClientService(): IOceanClientService {
    return this.oceanClientSvc;
  }

  override getActivityLogEntriesRepository(): IActivityLogEntriesRepository {
    return this.activityLogRepo;
  }
}

function makeRule(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: "rule-1",
    tenantId: "tenant-1",
    name: "Test Rule",
    triggeringEvent: "request_received",
    prompt: "Do something",
    active: true,
    enabledTools: [],
    summarizeAttachmentsAcknowledged: false,
    ...overrides,
  } as RoutingRule;
}

describe("processMessageController — attachment fetch guard", () => {
  let cxt: TestApplicationContext;
  let mockRoutingRulesRepo: IRoutingRulesRepository;
  let mockOceanClientService: IOceanClientService;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let mockFetchLetterData: ReturnType<typeof vi.fn>;
  let mockFetchCredentials: ReturnType<typeof vi.fn>;
  let addServiceRequestBundle: Bundle;

  beforeEach(async () => {
    vi.clearAllMocks();

    const bundlePath = path.join(
      process.cwd(),
      "test",
      "ereferral_miscellaneous.bundle.json"
    );
    addServiceRequestBundle = JSON.parse(fs.readFileSync(bundlePath, "utf-8"));

    mockFetchLetterData = vi.fn().mockResolvedValue(new Blob(["pdf"]));
    mockFetchCredentials = vi.fn().mockResolvedValue({ accessToken: "tok" });

    mockOceanClientService = {
      fetchOceanClientCredentials: mockFetchCredentials,
      testConnection: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue({ status: 200 }),
      fetchLetterData: mockFetchLetterData,
    };

    mockRoutingRulesRepo = {
      getAllAtTenant: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    mockActivityLogRepo = {
      create: vi.fn(),
      getAllAtTenant: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      removeAll: vi.fn(),
    };

    cxt = new TestApplicationContext(
      mockRoutingRulesRepo,
      mockOceanClientService,
      mockActivityLogRepo
    );
  });

  it("does not fetch attachments when no active rule has summarizeAttachments enabled", async () => {
    vi.mocked(mockRoutingRulesRepo.getAllAtTenant).mockResolvedValue([
      makeRule({ enabledTools: ["sendCommunicationToRequester"] }),
    ]);

    const { processMessageController } = await import(
      "../process-message.controller"
    );

    await processMessageController(
      { method: "POST", body: addServiceRequestBundle },
      cxt
    );

    expect(mockFetchCredentials).not.toHaveBeenCalled();
    expect(mockFetchLetterData).not.toHaveBeenCalled();
  });

  it("does not fetch attachments when the only summarizeAttachments rule is inactive", async () => {
    vi.mocked(mockRoutingRulesRepo.getAllAtTenant).mockResolvedValue([
      makeRule({ enabledTools: ["summarizeAttachments"], active: false }),
    ]);

    const { processMessageController } = await import(
      "../process-message.controller"
    );

    await processMessageController(
      { method: "POST", body: addServiceRequestBundle },
      cxt
    );

    expect(mockFetchLetterData).not.toHaveBeenCalled();
  });

  it("does not fetch attachments when summarizeAttachments rule targets a different event type", async () => {
    vi.mocked(mockRoutingRulesRepo.getAllAtTenant).mockResolvedValue([
      makeRule({
        enabledTools: ["summarizeAttachments"],
        triggeringEvent: "request_message",
      }),
    ]);

    const { processMessageController } = await import(
      "../process-message.controller"
    );

    await processMessageController(
      { method: "POST", body: addServiceRequestBundle },
      cxt
    );

    expect(mockFetchLetterData).not.toHaveBeenCalled();
  });

  it("fetches attachments when an active rule has summarizeAttachments enabled for the event type", async () => {
    vi.mocked(mockRoutingRulesRepo.getAllAtTenant).mockResolvedValue([
      makeRule({ enabledTools: ["summarizeAttachments"] }),
    ]);

    const { processMessageController } = await import(
      "../process-message.controller"
    );

    await processMessageController(
      { method: "POST", body: addServiceRequestBundle },
      cxt
    );

    expect(mockFetchCredentials).toHaveBeenCalledOnce();
    expect(mockFetchLetterData).toHaveBeenCalledOnce();
  });
});
