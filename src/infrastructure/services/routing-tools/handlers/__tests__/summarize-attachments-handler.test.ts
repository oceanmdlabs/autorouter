import fs from "fs";
import path from "path";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { IAiService } from "@/src/application/services/ai.service.interface";
import type { IOceanClientService } from "@/src/application/services/ocean-client.service.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import { uuid } from "@/src/entities/models/uuid";
import type { Bundle } from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeAttachmentsHandler } from "../summarize-attachments-handler";

process.env.DEPLOY_URL = "http://localhost:4000";

class TestApplicationContext extends ApplicationContext {
  constructor(
    public activityLogRepo: IActivityLogEntriesRepository,
    public aiSvc: IAiService,
    public oceanClientSvc: IOceanClientService
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

  override getAiService(): IAiService {
    return this.aiSvc;
  }

  override getOceanClientService(): IOceanClientService {
    return this.oceanClientSvc;
  }
}

describe("summarizeAttachmentsHandler", () => {
  let cxt: TestApplicationContext;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let mockAiService: IAiService;
  let mockOceanClientService: IOceanClientService;
  let sampleBundle: Bundle;

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

    mockAiService = {
      getToolCalls: vi.fn(),
      prompt: vi.fn(),
      summarizeAttachments: vi.fn().mockResolvedValue("Attachment summary text"),
    };

    mockOceanClientService = {
      fetchOceanClientCredentials: vi.fn(),
      testConnection: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue({ status: 200, ok: true }),
      fetchLetterData: vi.fn(),
    };

    cxt = new TestApplicationContext(
      mockActivityLogRepo,
      mockAiService,
      mockOceanClientService
    );

    const sampleBundlePath = path.join(
      process.cwd(),
      "test",
      "ereferral_miscellaneous.bundle.json"
    );
    sampleBundle = JSON.parse(fs.readFileSync(sampleBundlePath, "utf-8"));
  });

  const baseAction: RoutingToolAction<"summarizeAttachments"> = {
    id: uuid().toString(),
    tool: "summarizeAttachments",
    input: { instructions: "Summarize the attached documents." },
  };

  it("does not call AI service when no attachments are present", async () => {
    const eventContext = {
      triggeringEvent: "request_received" as const,
      serviceRequestBundle: sampleBundle,
      attachments: [],
    };

    await summarizeAttachmentsHandler(baseAction, eventContext, cxt);

    expect(mockAiService.summarizeAttachments).not.toHaveBeenCalled();
    expect(mockOceanClientService.sendMessage).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: "No attachments found to analyze" })
    );
  });

  it("does not call AI service when attachments property is absent", async () => {
    const eventContext = {
      triggeringEvent: "request_received" as const,
      serviceRequestBundle: sampleBundle,
    };

    await summarizeAttachmentsHandler(baseAction, eventContext, cxt);

    expect(mockAiService.summarizeAttachments).not.toHaveBeenCalled();
    expect(mockOceanClientService.sendMessage).not.toHaveBeenCalled();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: "No attachments found to analyze" })
    );
  });

  it("calls AI service and sends message when attachments are present", async () => {
    const eventContext = {
      triggeringEvent: "request_received" as const,
      serviceRequestBundle: sampleBundle,
      attachments: [
        { title: "referral.pdf", contentType: "application/pdf", data: new Blob(["pdf bytes"]) },
      ],
    };

    await summarizeAttachmentsHandler(baseAction, eventContext, cxt);

    expect(mockAiService.summarizeAttachments).toHaveBeenCalledOnce();
    expect(mockAiService.summarizeAttachments).toHaveBeenCalledWith(
      "Summarize the attached documents.",
      eventContext.attachments
    );
    expect(mockOceanClientService.sendMessage).toHaveBeenCalledOnce();
    expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        details: 'Attachment analysis completed and sent: "Attachment summary text"',
      })
    );
  });
});
