import fs from "fs";
import path from "path";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { IRoutingRulesRepository } from "@/src/application/repositories/routing-rules.repository.interface";
import type { IAiService } from "@/src/application/services/ai.service.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { Bundle, QuestionnaireResponse } from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processServiceRequestEventUseCase } from "../process-service-request-event.use-case";

class TestApplicationContext extends ApplicationContext {
  constructor(
    public routingRulesRepo: IRoutingRulesRepository,
    public aiSvc: IAiService,
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

  override getAiService(): IAiService {
    return this.aiSvc;
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
    enabledTools: ["sendCommunicationToRequester"],
    summarizeAttachmentsAcknowledged: false,
    ...overrides,
  } as RoutingRule;
}

function bundleWithAiOptOut(bundle: Bundle, optOut: boolean): Bundle {
  return {
    ...bundle,
    entry: bundle.entry?.map((entry) => {
      if (entry.resource?.resourceType !== "QuestionnaireResponse") return entry;
      const qr = entry.resource as QuestionnaireResponse;
      return {
        ...entry,
        resource: {
          ...qr,
          item: [
            ...(qr.item ?? []),
            { linkId: "ai_opt_out", answer: [{ valueBoolean: optOut }] },
          ],
        },
      };
    }),
  };
}

describe("processServiceRequestEventUseCase — patient AI opt-out", () => {
  let cxt: TestApplicationContext;
  let mockRoutingRulesRepo: IRoutingRulesRepository;
  let mockAiService: IAiService;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let sampleBundle: Bundle;

  beforeEach(() => {
    vi.clearAllMocks();

    const bundlePath = path.join(
      process.cwd(),
      "test",
      "ereferral_back_pain.bundle.json"
    );
    sampleBundle = JSON.parse(fs.readFileSync(bundlePath, "utf-8"));

    mockRoutingRulesRepo = {
      getAllAtTenant: vi.fn().mockResolvedValue([makeRule()]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    mockAiService = {
      getToolCalls: vi.fn().mockResolvedValue({ toolCalls: [], reasoning: "" }),
      prompt: vi.fn(),
      summarizeAttachments: vi.fn(),
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
      mockAiService,
      mockActivityLogRepo
    );
  });

  it("skips AI evaluation and processing when patient has opted out", async () => {
    const optOutBundle = bundleWithAiOptOut(sampleBundle, true);

    await processServiceRequestEventUseCase(
      {
        serviceRequestBundle: optOutBundle,
        triggeringEvent: "request_received",
      },
      cxt
    );

    expect(mockAiService.getToolCalls).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.stringContaining("opted out"),
      })
    );
  });

  it("runs AI evaluation when patient has not opted out", async () => {
    const normalBundle = bundleWithAiOptOut(sampleBundle, false);

    await processServiceRequestEventUseCase(
      {
        serviceRequestBundle: normalBundle,
        triggeringEvent: "request_received",
      },
      cxt
    );

    expect(mockAiService.getToolCalls).toHaveBeenCalledOnce();
  });
});
