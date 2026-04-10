import type { ApplicationContext } from "@/src/entities/models/application-context";
import type { RoutingEventMessage, ServiceRequestEventMessage } from "@/src/entities/models/routing-evaluation";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import {
  type LlmRuleDecisionOutput,
  type LlmDecisionParseResult,
  type LlmDecision,
  type LlmValidationStatus,
  type NewLlmRuleDecisionAuditRecord,
  type NewLlmRuleToolExecutionAuditRecord,
  llmRuleDecisionOutputSchema,
  LLM_DECISION,
  LLM_VALIDATION_STATUS,
  LLM_TOOL_EXECUTION_STATUS
} from "@/src/entities/models/llm-rule-decision";
import { createJsonDecisionPrompt } from "./prompts/evaluate-json-decision-prompt";
import { routingToolRegistry, type RoutingToolName } from "./routing-tools/routing-tool-registry";
import { isPatientEngagementEventMessage } from "@/src/entities/models/patient-engagement-event-context";
import { createHash } from "crypto";

type Dependencies = {
  cxt: ApplicationContext;
};

export type JsonDecisionEvaluationResult = {
  decision: LlmDecision;
  decisionAuditId: string;
  toolExecutionAuditIds: string[];
  /** Indices of tools that passed validation and are ready for execution */
  validToolIndices: number[];
  parsedOutput: LlmRuleDecisionOutput | null;
  validationStatus: LlmValidationStatus;
  validationError: string | null;
};

/**
 * Creates a hash of the tool arguments for deduplication/audit purposes
 */
function hashArgs(args: Record<string, unknown>): string {
  const canonical = JSON.stringify(args, Object.keys(args).sort());
  return createHash("sha256").update(canonical).digest("hex").substring(0, 16);
}

/**
 * Validates that tool names are allowed and arguments match schemas
 */
function validateToolPlans(
  tools: LlmRuleDecisionOutput["tools"],
  enabledTools: string[]
): { valid: boolean; error?: string } {
  for (const tool of tools) {
    const result = validateSingleToolPlan(tool, enabledTools);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validates a single tool plan and returns detailed error info
 */
function validateSingleToolPlan(
  tool: LlmRuleDecisionOutput["tools"][0],
  enabledTools: string[]
): { valid: boolean; error?: string; errorCode?: string } {
  // Check if tool is in the allowed list
  if (!enabledTools.includes(tool.toolName)) {
    return {
      valid: false,
      errorCode: "TOOL_NOT_ALLOWED",
      error: `Tool "${tool.toolName}" is not in the allowed tools list for this rule`
    };
  }

  // Check if tool exists in registry
  if (!(tool.toolName in routingToolRegistry)) {
    return {
      valid: false,
      errorCode: "TOOL_NOT_FOUND",
      error: `Tool "${tool.toolName}" does not exist in the routing tool registry`
    };
  }

  // Validate args against tool schema
  const toolDef = routingToolRegistry[tool.toolName as RoutingToolName];
  const argsResult = toolDef.input.safeParse(tool.args);
  if (!argsResult.success) {
    // Format the error message to be more helpful
    const issues = argsResult.error.issues.map(issue => {
      const path = issue.path.join(".");
      return `${path ? path + ": " : ""}${issue.message}`;
    }).join("; ");

    return {
      valid: false,
      errorCode: "INVALID_ARGS",
      error: `Invalid arguments for tool "${tool.toolName}": ${issues}`
    };
  }

  return { valid: true };
}

/**
 * Checks for patient PHI patterns in text (basic heuristic)
 * Note: Email addresses are NOT flagged as PHI since they may be clinic-provided configuration.
 * This check is only applied to reasonSummary and rationale fields, not tool args.
 *
 * We intentionally keep this conservative to avoid false positives that block legitimate outputs.
 * The word "patient" alone is NOT PHI - it's a common clinical term.
 */
function containsPotentialPatientPhi(text: string): boolean {
  // Patterns that strongly indicate actual patient PHI
  const phiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern (XXX-XX-XXXX)
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone number pattern
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, // Date patterns (DOB like MM/DD/YYYY)
    /\bMRN\s*[:#]?\s*\d+/i, // Medical Record Number with explicit label
    /\bpatient\s+name\s*:\s*\S+/i, // Explicit "patient name: ..." label
    /\bDOB\s*:\s*\S+/i, // Explicit DOB label
    /\bSSN\s*:\s*\S+/i, // Explicit SSN label
    /\baddress\s*:\s*\d+\s+\w+/i, // Address pattern with house number
  ];

  return phiPatterns.some((pattern) => pattern.test(text));
}

/**
 * Validates the LLM output for PHI in sensitive fields (reasonSummary and rationale only)
 * Tool args are NOT checked because they may contain clinic-provided configuration.
 */
function validateNoPhi(output: LlmRuleDecisionOutput): { valid: boolean; error?: string } {
  // Check reasonSummary
  if (containsPotentialPatientPhi(output.reasonSummary)) {
    return {
      valid: false,
      error: "reasonSummary appears to contain PHI"
    };
  }

  // Check tool rationales (but NOT tool args, which may contain clinic-provided config)
  for (const tool of output.tools) {
    if (containsPotentialPatientPhi(tool.rationale)) {
      return {
        valid: false,
        error: `Tool "${tool.toolName}" rationale appears to contain PHI`
      };
    }
  }

  return { valid: true };
}

/**
 * Parses and validates the raw LLM JSON output
 */
function parseAndValidateLlmOutput(
  rawOutput: string,
  rule: RoutingRule,
  referralId: string
): LlmDecisionParseResult {
  // Try to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    return {
      success: false,
      validationStatus: LLM_VALIDATION_STATUS.INVALID_JSON,
      validationError: "Failed to parse LLM output as JSON",
      rawOutput
    };
  }

  // Validate against schema
  const schemaResult = llmRuleDecisionOutputSchema.safeParse(parsed);
  if (!schemaResult.success) {
    return {
      success: false,
      validationStatus: LLM_VALIDATION_STATUS.INVALID_SCHEMA,
      validationError: `Schema validation failed: ${schemaResult.error.message}`,
      rawOutput
    };
  }

  const output = schemaResult.data;

  // Validate referralId matches
  if (output.referralId !== referralId) {
    return {
      success: false,
      validationStatus: LLM_VALIDATION_STATUS.INVALID_SCHEMA,
      validationError: `referralId mismatch: expected "${referralId}", got "${output.referralId}"`,
      rawOutput
    };
  }

  // Validate ruleId matches
  if (output.rule.ruleId !== rule.id) {
    return {
      success: false,
      validationStatus: LLM_VALIDATION_STATUS.INVALID_SCHEMA,
      validationError: `ruleId mismatch: expected "${rule.id}", got "${output.rule.ruleId}"`,
      rawOutput
    };
  }

  // Validate tool names and args
  const toolValidation = validateToolPlans(output.tools, rule.enabledTools);
  if (!toolValidation.valid) {
    return {
      success: false,
      validationStatus: LLM_VALIDATION_STATUS.INVALID_SCHEMA,
      validationError: toolValidation.error!,
      rawOutput
    };
  }

  // Validate no PHI
  const phiValidation = validateNoPhi(output);
  if (!phiValidation.valid) {
    return {
      success: false,
      validationStatus: LLM_VALIDATION_STATUS.DISALLOWED_CONTENT,
      validationError: phiValidation.error!,
      rawOutput
    };
  }

  return {
    success: true,
    data: output
  };
}

export const createJsonDecisionEvaluatorService = (deps: Dependencies) => {
  const { cxt } = deps;

  /**
   * Evaluates a rule using JSON-based decision output from the LLM
   * and writes audit records to the database.
   */
  async function evaluateRuleWithJsonDecision({
                                                rule,
                                                routingEventMessage,
                                                eventType,
                                                referralId,
                                                siteId
                                              }: {
    rule: RoutingRule;
    routingEventMessage: RoutingEventMessage;
    eventType: RoutingEventType;
    referralId: string;
    siteId: string;
  }): Promise<JsonDecisionEvaluationResult> {
    // For now, only support ServiceRequest events (not PatientEngagement)
    if (isPatientEngagementEventMessage(routingEventMessage)) {
      return await writeSkipAudit({
        siteId,
        referralId,
        rule,
        decision: LLM_DECISION.SKIP,
        reason: "JSON decision evaluation not yet supported for patient engagement events",
        validationStatus: LLM_VALIDATION_STATUS.OTHER,
        validationError: null
      });
    }

    const serviceRequestMessage = routingEventMessage as ServiceRequestEventMessage;

    // Generate the prompt
    const prompt = createJsonDecisionPrompt({
      rule,
      routingEventMessage: serviceRequestMessage,
      eventType,
      referralId
    });

    cxt.logger.debug(`JSON decision prompt for rule [${rule.name}]:`, { prompt });

    let parsedOutput: LlmRuleDecisionOutput;

    try {
      // Call the AI service with promptForJson which uses generateText for more flexible JSON generation
      // This allows the LLM to follow prompt instructions for args rather than being constrained by schema
      parsedOutput = await cxt.getAiService().promptForJson(prompt, llmRuleDecisionOutputSchema);
    } catch (error) {
      cxt.logger.error(`Error getting JSON decision from AI for rule [${rule.name}]`, { error });
      return await writeSkipAudit({
        siteId,
        referralId,
        rule,
        decision: LLM_DECISION.ERROR,
        reason: `AI service error: ${(error as Error).message}`,
        validationStatus: LLM_VALIDATION_STATUS.OTHER,
        validationError: (error as Error).message
      });
    }

    cxt.logger.debug(`Raw LLM JSON output for rule [${rule.name}]: ${JSON.stringify(parsedOutput, null, 2)}`);

    // Check for PHI in the output first (this is a hard stop)
    const phiValidation = validateNoPhi(parsedOutput);
    if (!phiValidation.valid) {
      return await writeSkipAudit({
        siteId,
        referralId,
        rule,
        decision: LLM_DECISION.SKIP,
        reason: phiValidation.error!,
        validationStatus: LLM_VALIDATION_STATUS.DISALLOWED_CONTENT,
        validationError: phiValidation.error!
      });
    }

    // Write the decision audit record first (we always record what the LLM decided)
    const decisionAuditRecord: NewLlmRuleDecisionAuditRecord = {
      siteId,
      referralId,
      ruleId: rule.id,
      ruleName: rule.name,
      ruleVersion: parsedOutput.rule.ruleVersion,
      decision: parsedOutput.decision as LlmDecision,
      confidence: parsedOutput.confidence,
      reason: parsedOutput.reasonSummary,
      modelName: parsedOutput.model.name,
      modelRequestId: parsedOutput.model.requestId,
      validationStatus: LLM_VALIDATION_STATUS.VALID, // We'll update if tools have issues
      validationError: null
    };

    const decisionAuditId = await cxt
      .getLlmRuleDecisionAuditRepository()
      .create(decisionAuditRecord);

    // If EXECUTE with tools, create tool audit records and validate each tool
    let toolExecutionAuditIds: string[] = [];
    const validToolIndices: number[] = [];
    const toolValidationErrors: string[] = [];

    if (parsedOutput.decision === "EXECUTE" && parsedOutput.tools.length > 0) {
      // Create all tool audit records as PLANNED first
      const toolRecords: NewLlmRuleToolExecutionAuditRecord[] = parsedOutput.tools.map(
        (tool, index) => ({
          decisionAuditId,
          siteId,
          referralId,
          ruleId: rule.id,
          toolIndex: index,
          toolName: tool.toolName,
          argsHash: hashArgs(tool.args),
          status: LLM_TOOL_EXECUTION_STATUS.PLANNED,
          errorCode: null,
          errorSummary: null,
          startedAt: null,
          finishedAt: null
        })
      );

      toolExecutionAuditIds = await cxt
        .getLlmRuleToolExecutionAuditRepository()
        .createMany(toolRecords);

      // Now validate each tool individually and update status if invalid
      for (let i = 0; i < parsedOutput.tools.length; i++) {
        const tool = parsedOutput.tools[i];
        const toolAuditId = toolExecutionAuditIds[i];

        if (!tool || !toolAuditId) continue;

        const validation = validateSingleToolPlan(tool, rule.enabledTools);

        if (!validation.valid) {
          // Update the tool audit record to SKIPPED with the error
          await cxt.getLlmRuleToolExecutionAuditRepository().updateStatus(
            toolAuditId,
            LLM_TOOL_EXECUTION_STATUS.SKIPPED,
            {
              errorCode: validation.errorCode || "VALIDATION_ERROR",
              errorSummary: validation.error?.substring(0, 200) || "Unknown validation error",
              finishedAt: new Date()
            }
          );
          toolValidationErrors.push(validation.error || "Unknown error");
          cxt.logger.warn(`Tool validation failed for ${tool.toolName}`, {
            toolName: tool.toolName,
            error: validation.error,
            errorCode: validation.errorCode
          });
        } else {
          validToolIndices.push(i);
        }
      }
    }

    // If all tools failed validation, log this
    if (parsedOutput.decision === "EXECUTE" && validToolIndices.length === 0 && parsedOutput.tools.length > 0) {
      cxt.logger.warn(`All tools failed validation for rule [${rule.name}]`, {
        decisionAuditId,
        errors: toolValidationErrors
      });
    }

    // Warn if LLM returned multiple tools (prompt requests single tool unless explicitly needed)
    if (parsedOutput.tools.length > 1) {
      cxt.logger.warn(`LLM returned ${parsedOutput.tools.length} tools for rule [${rule.name}] - expected 1 unless multi-tool was explicitly requested`, {
        decisionAuditId,
        toolNames: parsedOutput.tools.map(t => t.toolName)
      });
    }

    cxt.logger.info(`JSON decision for rule [${rule.name}]: ${parsedOutput.decision}`, {
      decisionAuditId,
      decision: parsedOutput.decision,
      confidence: parsedOutput.confidence,
      toolCount: parsedOutput.tools.length,
      validToolCount: validToolIndices.length
    });

    return {
      decision: parsedOutput.decision as LlmDecision,
      decisionAuditId,
      toolExecutionAuditIds,
      validToolIndices,
      parsedOutput,
      validationStatus: LLM_VALIDATION_STATUS.VALID,
      validationError: null
    };
  }

  /**
   * Helper to write a SKIP/ERROR audit record when validation fails
   */
  async function writeSkipAudit({
                                  siteId,
                                  referralId,
                                  rule,
                                  decision,
                                  reason,
                                  validationStatus,
                                  validationError
                                }: {
    siteId: string;
    referralId: string;
    rule: RoutingRule;
    decision: LlmDecision;
    reason: string;
    validationStatus: LlmValidationStatus;
    validationError: string | null;
  }): Promise<JsonDecisionEvaluationResult> {
    const decisionAuditRecord: NewLlmRuleDecisionAuditRecord = {
      siteId,
      referralId,
      ruleId: rule.id,
      ruleName: rule.name,
      ruleVersion: "1.0",
      decision,
      confidence: null,
      reason,
      modelName: null,
      modelRequestId: null,
      validationStatus,
      validationError
    };

    const decisionAuditId = await cxt
      .getLlmRuleDecisionAuditRepository()
      .create(decisionAuditRecord);

    return {
      decision,
      decisionAuditId,
      toolExecutionAuditIds: [],
      validToolIndices: [],
      parsedOutput: null,
      validationStatus,
      validationError
    };
  }

  /**
   * Updates a tool execution audit record after execution
   */
  async function updateToolExecutionStatus(
    toolExecutionAuditId: string,
    success: boolean,
    error?: { code?: string; summary?: string },
    startedAt?: Date
  ): Promise<void> {
    const finishedAt = new Date();
    const status = success
      ? LLM_TOOL_EXECUTION_STATUS.SUCCESS
      : LLM_TOOL_EXECUTION_STATUS.FAILED;

    await cxt.getLlmRuleToolExecutionAuditRepository().updateStatus(
      toolExecutionAuditId,
      status,
      {
        startedAt: startedAt ?? null,
        finishedAt,
        errorCode: error?.code ?? null,
        errorSummary: error?.summary ?? null
      }
    );
  }

  return {
    evaluateRuleWithJsonDecision,
    updateToolExecutionStatus,
    // Export for testing
    parseAndValidateLlmOutput: (rawOutput: string, rule: RoutingRule, referralId: string) =>
      parseAndValidateLlmOutput(rawOutput, rule, referralId)
  };
};

