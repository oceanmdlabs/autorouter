import type { IDbService } from "@/src/application/services/db.service.interface";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import { uuid } from "@/src/entities/models/uuid";
import type { Bundle } from "fhir/r4";
import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRoutingToolActionService } from "@/src/application/services/routing-tool-action.service.interface";

class TestApplicationContext extends ApplicationContext {
  constructor() {
    super({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
      debug: vi.fn(),                // added
      setLevel: vi.fn(),             // added
      level: "info" as unknown as any // added (cast to satisfy the expected type)
    });
  }

  override getDbService(): IDbService {
    return {
      initMetadata: vi.fn(),
      initMetadataAndTenant: vi.fn(),
      updateMetadata: vi.fn(),
      getSiteFilter: vi.fn(),
      withSiteFilter: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
      count: vi.fn(),
      findManyGlobal: vi.fn(),
      findFirstGlobal: vi.fn(),
      updateGlobal: vi.fn(),
      deleteGlobal: vi.fn(),
      insertGlobal: vi.fn(),
      insertGlobalReturning: vi.fn(),
      insertGlobalReturningMany: vi.fn(),
      countGlobal: vi.fn()
    };
  }
}

describe("RoutingToolActionService", () => {
  let routingService: IRoutingToolActionService;
  let cxt: TestApplicationContext;
  let sampleBundle: Bundle;
  let mockSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a mock context
    cxt = new TestApplicationContext();
    mockSendMessage = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({})
    });
    cxt.getOceanClientService().sendMessage = mockSendMessage;

    cxt.getActivityLogEntriesRepository().create = vi.fn();

    routingService = cxt.getRoutingToolActionService();

    // Read and parse the sample FHIR bundle
    const sampleBundlePath = path.join(
      process.cwd(),
      "test",
      "ereferral_miscellaneous.bundle.json"
    );
    const sampleBundleJson = fs.readFileSync(sampleBundlePath, "utf-8");
    sampleBundle = JSON.parse(sampleBundleJson);
  });

  describe("executeAction", () => {
    it("should throw an error for an unsupported action type", async () => {
      const action: RoutingToolAction<"updateCategory"> = {
        id: uuid().toString(),
        tool: "unsupported_type" as never,
        input: {
          snomedCode: "12345678" // SNOMED code
        }
      };

      await expect(
        routingService.executeActions([action], {
          serviceRequestBundle: sampleBundle,
          triggeringEvent: "request_received"
        })
      ).rejects.toThrow("Unsupported action tool: unsupported_type");
    });
  });
});
