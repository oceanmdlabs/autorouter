import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { IDbService } from "@/src/application/services/db.service.interface";
import type { IAiService } from "@/src/application/services/ai.service.interface";
import type {
  ILlmRuleDecisionAuditRepository,
  ILlmRuleToolExecutionAuditRepository
} from "@/src/application/repositories/llm-rule-decision-audit.repository.interface";
import { createJsonDecisionEvaluatorService } from "../json-decision-evaluator.service";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { Bundle } from "fhir/r4";
import {
  LLM_DECISION,
  LLM_VALIDATION_STATUS,
  LLM_TOOL_EXECUTION_STATUS,
  type LlmRuleDecisionOutput
} from "@/src/entities/models/llm-rule-decision";

// Test ApplicationContext with mocked dependencies
class TestApplicationContext extends ApplicationContext {
  private mockAiService: IAiService;
  private mockDecisionAuditRepo: ILlmRuleDecisionAuditRepository;
  private mockToolExecutionAuditRepo: ILlmRuleToolExecutionAuditRepository;

  constructor() {
    super({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
      debug: vi.fn(),
      setLevel: vi.fn(),
      level: "info" as unknown as any
    });

    this.mockAiService = {
      getToolCalls: vi.fn(),
      prompt: vi.fn(),
      promptForJson: vi.fn(),
      summarizeAttachments: vi.fn()
    };

    this.mockDecisionAuditRepo = {
      create: vi.fn().mockResolvedValue("decision-audit-id-1"),
      get: vi.fn(),
      findByReferralId: vi.fn(),
      getPaginatedDecisions: vi.fn(),
      getDistinctRulesForSite: vi.fn(),
      findUnencryptedForSite: vi.fn().mockResolvedValue([]),
      updateWithEncryptedReason: vi.fn(),
      countUnencryptedForSite: vi.fn().mockResolvedValue(0)
    };

    this.mockToolExecutionAuditRepo = {
      create: vi.fn().mockResolvedValue("tool-audit-id-1"),
      createMany: vi.fn().mockResolvedValue(["tool-audit-id-1", "tool-audit-id-2"]),
      updateStatus: vi.fn(),
      findByDecisionAuditId: vi.fn(),
      findByDecisionAuditIds: vi.fn(),
      get: vi.fn()
    };
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

  override getAiService(): IAiService {
    return this.mockAiService;
  }

  override getLlmRuleDecisionAuditRepository(): ILlmRuleDecisionAuditRepository {
    return this.mockDecisionAuditRepo;
  }

  override getLlmRuleToolExecutionAuditRepository(): ILlmRuleToolExecutionAuditRepository {
    return this.mockToolExecutionAuditRepo;
  }

  getMockAiService(): IAiService {
    return this.mockAiService;
  }

  getMockDecisionAuditRepo(): ILlmRuleDecisionAuditRepository {
    return this.mockDecisionAuditRepo;
  }

  getMockToolExecutionAuditRepo(): ILlmRuleToolExecutionAuditRepository {
    return this.mockToolExecutionAuditRepo;
  }
}

// Sample test data
const createTestRule = (overrides?: Partial<RoutingRule>): RoutingRule => ({
  id: "rule-123",
  tenantId: "tenant-1",
  name: "Test Rule",
  triggeringEvent: "request_received",
  prompt: "Auto-accept referrals that match cardiac criteria",
  active: true,
  enabledTools: ["changeStatus", "sendCommunicationToRequester"],
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "system",
  updatedBy: "system",
  ...overrides
});

const createTestBundle = (): Bundle => ({
  resourceType: "Bundle",
  type: "collection",
  entry: [
    {
      resource: {
        resourceType: "ServiceRequest",
        id: "sr-123",
        status: "active",
        intent: "order",
        subject: {
          reference: "Patient/patient-123"
        },
        note: [
          {
            text: "Patient referred for cardiac assessment. History of chest pain."
          }
        ]
      }
    }
  ]
});

const createValidExecuteOutput = (overrides?: Partial<LlmRuleDecisionOutput>): LlmRuleDecisionOutput => ({
  referralId: "R-12345",
  rule: {
    ruleId: "rule-123",
    ruleName: "Test Rule",
    ruleVersion: "1.0"
  },
  decision: "EXECUTE",
  reasonSummary: "Referral matches cardiac criteria",
  confidence: 0.92,
  tools: [
    {
      toolName: "changeStatus",
      args: { status: "accepted" },
      rationale: "Auto-accept this referral"
    }
  ],
  model: {
    name: "gpt-4",
    requestId: "req-123"
  },
  ...overrides
});

const createValidSkipOutput = (): LlmRuleDecisionOutput => ({
  referralId: "R-12345",
  rule: {
    ruleId: "rule-123",
    ruleName: "Test Rule",
    ruleVersion: "1.0"
  },
  decision: "SKIP",
  reasonSummary: "Referral does not match criteria",
  confidence: 0.85,
  tools: [],
  model: {
    name: "gpt-4",
    requestId: "req-456"
  }
});

describe("JsonDecisionEvaluatorService", () => {
  let cxt: TestApplicationContext;
  let evaluatorService: ReturnType<typeof createJsonDecisionEvaluatorService>;

  beforeEach(() => {
    vi.clearAllMocks();
    cxt = new TestApplicationContext();
    evaluatorService = createJsonDecisionEvaluatorService({ cxt });
  });

  describe("evaluateRuleWithJsonDecision", () => {
    it("should return EXECUTE decision with tool audit records for valid EXECUTE output", async () => {
      const rule = createTestRule();
      const bundle = createTestBundle();
      const aiOutput = createValidExecuteOutput();

      (cxt.getMockAiService().promptForJson as ReturnType<typeof vi.fn>).mockResolvedValue(aiOutput);

      const result = await evaluatorService.evaluateRuleWithJsonDecision({
        rule,
        routingEventMessage: bundle,
        eventType: "request_received",
        referralId: "R-12345",
        siteId: "site-1"
      });

      expect(result.decision).toBe(LLM_DECISION.EXECUTE);
      expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.VALID);
      expect(result.parsedOutput).toBeDefined();
      expect(result.parsedOutput?.tools.length).toBe(1);
      expect(result.decisionAuditId).toBe("decision-audit-id-1");
      expect(result.validToolIndices).toEqual([0]); // First tool is valid

      // Verify decision audit was created
      expect(cxt.getMockDecisionAuditRepo().create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: "site-1",
          referralId: "R-12345",
          ruleId: "rule-123",
          decision: LLM_DECISION.EXECUTE,
          validationStatus: LLM_VALIDATION_STATUS.VALID
        })
      );

      // Verify tool execution audit records were created
      expect(cxt.getMockToolExecutionAuditRepo().createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            toolName: "changeStatus",
            status: LLM_TOOL_EXECUTION_STATUS.PLANNED
          })
        ])
      );
    });

    it("should return SKIP decision with no tool audit records for valid SKIP output", async () => {
      const rule = createTestRule();
      const bundle = createTestBundle();
      const aiOutput = createValidSkipOutput();

      (cxt.getMockAiService().promptForJson as ReturnType<typeof vi.fn>).mockResolvedValue(aiOutput);

      const result = await evaluatorService.evaluateRuleWithJsonDecision({
        rule,
        routingEventMessage: bundle,
        eventType: "request_received",
        referralId: "R-12345",
        siteId: "site-1"
      });

      expect(result.decision).toBe("SKIP");
      expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.VALID);
      expect(result.parsedOutput).toBeDefined();
      expect(result.parsedOutput?.tools.length).toBe(0);
      expect(result.toolExecutionAuditIds.length).toBe(0);
      expect(result.validToolIndices.length).toBe(0);

      // Verify decision audit was created
      expect(cxt.getMockDecisionAuditRepo().create).toHaveBeenCalled();

      // Verify no tool execution records were created
      expect(cxt.getMockToolExecutionAuditRepo().createMany).not.toHaveBeenCalled();
    });

    it("should return ERROR decision when AI service throws an error", async () => {
      const rule = createTestRule();
      const bundle = createTestBundle();

      (cxt.getMockAiService().promptForJson as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("AI service unavailable")
      );

      const result = await evaluatorService.evaluateRuleWithJsonDecision({
        rule,
        routingEventMessage: bundle,
        eventType: "request_received",
        referralId: "R-12345",
        siteId: "site-1"
      });

      expect(result.decision).toBe(LLM_DECISION.ERROR);
      expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.OTHER);
      expect(result.validationError).toContain("AI service");
      expect(result.parsedOutput).toBeNull();
    });

    it("should create EXECUTE decision but mark tool as SKIPPED when tool not in allowed list", async () => {
      const rule = createTestRule({ enabledTools: ["sendSms"] }); // Only sendSms allowed
      const bundle = createTestBundle();
      const aiOutput = createValidExecuteOutput(); // Uses changeStatus which is not allowed

      (cxt.getMockAiService().promptForJson as ReturnType<typeof vi.fn>).mockResolvedValue(aiOutput);

      const result = await evaluatorService.evaluateRuleWithJsonDecision({
        rule,
        routingEventMessage: bundle,
        eventType: "request_received",
        referralId: "R-12345",
        siteId: "site-1"
      });

      // Decision is still EXECUTE (what the LLM decided)
      expect(result.decision).toBe(LLM_DECISION.EXECUTE);
      expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.VALID);
      // But no tools are valid for execution
      expect(result.validToolIndices.length).toBe(0);
      // Tool audit record was created and then updated to SKIPPED
      expect(cxt.getMockToolExecutionAuditRepo().createMany).toHaveBeenCalled();
      expect(cxt.getMockToolExecutionAuditRepo().updateStatus).toHaveBeenCalledWith(
        expect.any(String),
        LLM_TOOL_EXECUTION_STATUS.SKIPPED,
        expect.objectContaining({
          errorCode: "TOOL_NOT_ALLOWED",
          errorSummary: expect.stringContaining("not in the allowed tools list")
        })
      );
    });

    it("should create EXECUTE decision but mark tool as SKIPPED when args are invalid", async () => {
      const rule = createTestRule();
      const bundle = createTestBundle();
      // Create an output with empty args (invalid for changeStatus which requires 'status')
      const aiOutput = createValidExecuteOutput({
        tools: [
          {
            toolName: "changeStatus",
            args: {}, // Missing required 'status' field
            rationale: "Change status but forgot the args"
          }
        ]
      });

      (cxt.getMockAiService().promptForJson as ReturnType<typeof vi.fn>).mockResolvedValue(aiOutput);

      const result = await evaluatorService.evaluateRuleWithJsonDecision({
        rule,
        routingEventMessage: bundle,
        eventType: "request_received",
        referralId: "R-12345",
        siteId: "site-1"
      });

      // Decision is still EXECUTE (what the LLM decided)
      expect(result.decision).toBe(LLM_DECISION.EXECUTE);
      // But no tools are valid for execution
      expect(result.validToolIndices.length).toBe(0);
      // Tool audit record was created and then updated to SKIPPED
      expect(cxt.getMockToolExecutionAuditRepo().updateStatus).toHaveBeenCalledWith(
        expect.any(String),
        LLM_TOOL_EXECUTION_STATUS.SKIPPED,
        expect.objectContaining({
          errorCode: "INVALID_ARGS",
          errorSummary: expect.stringContaining("Invalid arguments")
        })
      );
    });
  });

  describe("updateToolExecutionStatus", () => {
    it("should update tool execution status to SUCCESS", async () => {
      await evaluatorService.updateToolExecutionStatus("tool-audit-id-1", true);

      expect(cxt.getMockToolExecutionAuditRepo().updateStatus).toHaveBeenCalledWith(
        "tool-audit-id-1",
        LLM_TOOL_EXECUTION_STATUS.SUCCESS,
        expect.objectContaining({
          finishedAt: expect.any(Date)
        })
      );
    });

    it("should update tool execution status to FAILED with error info", async () => {
      await evaluatorService.updateToolExecutionStatus("tool-audit-id-1", false, {
        code: "EXECUTION_ERROR",
        summary: "Failed to change status"
      });

      expect(cxt.getMockToolExecutionAuditRepo().updateStatus).toHaveBeenCalledWith(
        "tool-audit-id-1",
        LLM_TOOL_EXECUTION_STATUS.FAILED,
        expect.objectContaining({
          finishedAt: expect.any(Date),
          errorCode: "EXECUTION_ERROR",
          errorSummary: "Failed to change status"
        })
      );
    });
  });

  describe("parseAndValidateLlmOutput", () => {
    it("should detect invalid JSON", () => {
      const rule = createTestRule();
      const result = evaluatorService.parseAndValidateLlmOutput(
        "not valid json {",
        rule,
        "R-12345"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.INVALID_JSON);
      }
    });

    it("should detect schema validation errors", () => {
      const rule = createTestRule();
      const invalidOutput = JSON.stringify({
        referralId: "R-12345",
        decision: "MAYBE" // Invalid decision value
      });

      const result = evaluatorService.parseAndValidateLlmOutput(
        invalidOutput,
        rule,
        "R-12345"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.INVALID_SCHEMA);
      }
    });

    it("should detect referralId mismatch", () => {
      const rule = createTestRule();
      const output = createValidSkipOutput();
      output.referralId = "R-WRONG";

      const result = evaluatorService.parseAndValidateLlmOutput(
        JSON.stringify(output),
        rule,
        "R-12345"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.INVALID_SCHEMA);
        expect(result.validationError).toContain("referralId mismatch");
      }
    });

    it("should detect ruleId mismatch", () => {
      const rule = createTestRule();
      const output = createValidSkipOutput();
      output.rule.ruleId = "wrong-rule-id";

      const result = evaluatorService.parseAndValidateLlmOutput(
        JSON.stringify(output),
        rule,
        "R-12345"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.INVALID_SCHEMA);
        expect(result.validationError).toContain("ruleId mismatch");
      }
    });

    it("should detect disallowed tool names", () => {
      const rule = createTestRule({ enabledTools: ["sendSms"] });
      const output = createValidExecuteOutput();

      const result = evaluatorService.parseAndValidateLlmOutput(
        JSON.stringify(output),
        rule,
        "R-12345"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.validationStatus).toBe(LLM_VALIDATION_STATUS.INVALID_SCHEMA);
        expect(result.validationError).toContain("not in the allowed tools list");
      }
    });

    it("should parse valid EXECUTE output successfully", () => {
      const rule = createTestRule();
      const output = createValidExecuteOutput();

      const result = evaluatorService.parseAndValidateLlmOutput(
        JSON.stringify(output),
        rule,
        "R-12345"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.decision).toBe("EXECUTE");
        expect(result.data.tools.length).toBe(1);
      }
    });

    it("should parse valid SKIP output successfully", () => {
      const rule = createTestRule();
      const output = createValidSkipOutput();

      const result = evaluatorService.parseAndValidateLlmOutput(
        JSON.stringify(output),
        rule,
        "R-12345"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.decision).toBe("SKIP");
        expect(result.data.tools.length).toBe(0);
      }
    });
  });
});

