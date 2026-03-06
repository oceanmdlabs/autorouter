import fs from "fs";
import path from "path";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { IOceanClientService } from "@/src/application/services/ocean-client.service.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import { uuid } from "@/src/entities/models/uuid";
import type {
  Bundle,
  Communication,
  MessageHeader,
  PractitionerRole,
} from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DEPLOY_URL = "http://localhost:4000";
process.env.DEPLOY_URL = DEPLOY_URL;

class TestApplicationContext extends ApplicationContext {
  constructor(
    public activityLogRepo: IActivityLogEntriesRepository,
    public oceanClientService: IOceanClientService
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

  override getOceanClientService(): IOceanClientService {
    return this.oceanClientService;
  }
}

describe("sendCommunicationHandler", () => {
  let cxt: TestApplicationContext;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
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

    mockOceanClientService = {
      fetchOceanClientCredentials: vi.fn(),
      testConnection: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        ok: true,
        json: vi.fn(),
      }),
      fetchLetterData: vi.fn(),
    };

    cxt = new TestApplicationContext(
      mockActivityLogRepo,
      mockOceanClientService
    );

    const sampleBundlePath = path.join(
      process.cwd(),
      "test",
      "ereferral_miscellaneous.bundle.json"
    );
    sampleBundle = JSON.parse(fs.readFileSync(sampleBundlePath, "utf-8"));
  });

  it("sends the new send-communication event with an autorouter sender", async () => {
    const { sendCommunicationHandler } = await import(
      "../send-communication-handler"
    );
    const action: RoutingToolAction<"sendCommunicationToRequester"> = {
      id: uuid().toString(),
      tool: "sendCommunicationToRequester",
      input: {
        message: "Please review the attached referral details.",
      },
    };
    const eventContext = {
      resourceId: "123",
      tenantId: "test-tenant",
      traceId: "trace-123",
      triggeringEvent: "request_received" as const,
      serviceRequestBundle: sampleBundle,
    };

    await sendCommunicationHandler(action, eventContext, cxt);

    expect(mockOceanClientService.sendMessage).toHaveBeenCalledOnce();
    const sentMessage = vi.mocked(mockOceanClientService.sendMessage).mock
      .calls[0]?.[0].message as Bundle;

    const messageHeader = sentMessage.entry?.find(
      (entry) => entry.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(messageHeader.eventCoding?.code).toBe("send-communication");

    const sender = sentMessage.entry?.find(
      (entry) =>
        entry.resource?.resourceType === "PractitionerRole" &&
        entry.resource.id === "autorouter-sender"
    )?.resource as PractitionerRole;
    expect(sender.identifier?.[0]).toEqual({
      system: `${DEPLOY_URL}/fhir/NamingSystem/autorouter-sender`,
      value: "Autorouter",
    });

    const communication = sentMessage.entry?.find(
      (entry) => entry.resource?.resourceType === "Communication"
    )?.resource as Communication;
    expect(communication.sender).toEqual({
      reference: "PractitionerRole/autorouter-sender",
      identifier: {
        system: `${DEPLOY_URL}/fhir/NamingSystem/autorouter-sender`,
        value: "Autorouter",
      },
    });

    expect(mockActivityLogRepo.create).toHaveBeenCalledWith({
      ...eventContext,
      tool: "sendCommunicationToRequester",
      details:
        'Sent communication to requester: "Please review the attached referral details."',
      error: null,
    });
  });
});
