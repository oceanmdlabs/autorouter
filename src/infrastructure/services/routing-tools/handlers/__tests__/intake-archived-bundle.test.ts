import fs from "fs";
import path from "path";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { IOceanClientService } from "@/src/application/services/ocean-client.service.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { PatientEngagementEventContext } from "@/src/entities/models/patient-engagement-event-context";
import type { OceanPatient, PatientNote } from "@/src/entities/models/ocean-patient";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import { uuid } from "@/src/entities/models/uuid";
import type { Bundle, MessageHeader, Task, PractitionerRole } from "fhir/r4";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DEPLOY_URL = "http://localhost:4000";
process.env.DEPLOY_URL = DEPLOY_URL;

class TestApplicationContext extends ApplicationContext {
  constructor(
    public activityLogRepo: IActivityLogEntriesRepository,
    public oceanClientService: IOceanClientService
  ) {
    super({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn() });
  }

  override getActivityLogEntriesRepository(): IActivityLogEntriesRepository {
    return this.activityLogRepo;
  }

  override getOceanClientService(): IOceanClientService {
    return this.oceanClientService;
  }
}

/**
 * Validates that a matched archived eRequest `rawBundle`, exposed on an
 * `intake_questionnaire_completed` event context as `serviceRequestBundle`, is
 * sufficient for existing service-request tool handlers to render an outbound
 * Ocean message — i.e. the archival bundle drives status changes for the
 * matched referral without any handler changes.
 */
describe("service-request tools on a matched archived intake bundle", () => {
  let cxt: TestApplicationContext;
  let mockActivityLogRepo: IActivityLogEntriesRepository;
  let mockOceanClientService: IOceanClientService;
  let archivedBundle: Bundle;

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

    cxt = new TestApplicationContext(mockActivityLogRepo, mockOceanClientService);

    archivedBundle = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "test", "ereferral_miscellaneous.bundle.json"),
        "utf-8"
      )
    );
  });

  function makeIntakeContext(): PatientEngagementEventContext {
    return {
      triggeringEvent: "intake_questionnaire_completed",
      referralRef: "ref-123",
      // The archived rawBundle exposed for outbound Ocean tools:
      serviceRequestBundle: archivedBundle,
      message: {
        oceanSessionId: "session-1",
        patient: { ref: "pt-1" } as unknown as OceanPatient,
        note: { noteId: "note-1" } as unknown as PatientNote,
        matchedErequest: {
          erequestId: "er-1",
          referralRef: "ref-123",
          receivedAt: new Date("2026-01-01T00:00:00Z"),
        },
      },
    };
  }

  it("renders a status-change message from the archived bundle", async () => {
    const { changeStatusHandler } = await import("../change-status-handler");
    const action: RoutingToolAction<"changeStatus"> = {
      id: uuid().toString(),
      tool: "changeStatus",
      input: { status: "accepted", reason: "Intake complete" },
    };

    await changeStatusHandler(action, makeIntakeContext(), cxt, "Accept on intake");

    expect(mockOceanClientService.sendMessage).toHaveBeenCalledOnce();
    const sentMessage = vi.mocked(mockOceanClientService.sendMessage).mock
      .calls[0]?.[0].message as Bundle;

    const header = sentMessage.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe("notify-update-process-request");

    const task = sentMessage.entry?.find(
      (e) => e.resource?.resourceType === "Task"
    )?.resource as Task;
    expect(task.status).toBe("accepted");
    expect(header.focus?.[0]?.reference).toBe("Task/" + task.id);
  });

  it("renders a forward message from the archived bundle", async () => {
    const { createForwardMessage } = await import(
      "../../../ocean-message/forward-assign"
    );
    const result = createForwardMessage(archivedBundle, {
      forwardToListingRef: "listing-789",
    });

    const forwardTo = result.entry?.find(
      (e) =>
        e.resource?.resourceType === "PractitionerRole" &&
        e.resource.identifier?.[0]?.system === "id-referral-target-reference"
    )?.resource as PractitionerRole;
    expect(forwardTo.identifier?.[0]?.value).toBe("listing-789");
  });
});
