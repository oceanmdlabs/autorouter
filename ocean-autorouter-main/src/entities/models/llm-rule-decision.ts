import { z } from "zod";

// Decision types
export const LLM_DECISION = {
  EXECUTE: "EXECUTE",
  SKIP: "SKIP",
  ERROR: "ERROR"
} as const;

export type LlmDecision = (typeof LLM_DECISION)[keyof typeof LLM_DECISION];

// Validation status types
export const LLM_VALIDATION_STATUS = {
  VALID: "VALID",
  INVALID_JSON: "INVALID_JSON",
  INVALID_SCHEMA: "INVALID_SCHEMA",
  DISALLOWED_CONTENT: "DISALLOWED_CONTENT",
  OTHER: "OTHER"
} as const;

export type LlmValidationStatus = (typeof LLM_VALIDATION_STATUS)[keyof typeof LLM_VALIDATION_STATUS];

// Tool execution status types
export const LLM_TOOL_EXECUTION_STATUS = {
  PLANNED: "PLANNED",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED"
} as const;

export type LlmToolExecutionStatus = (typeof LLM_TOOL_EXECUTION_STATUS)[keyof typeof LLM_TOOL_EXECUTION_STATUS];

// Feature flag modes
export const LLM_RULE_JSON_DECISION_AUDIT_MODE = {
  OFF: "OFF",
  SHADOW: "SHADOW",
  ON: "ON"
} as const;

export type LlmRuleJsonDecisionAuditMode = (typeof LLM_RULE_JSON_DECISION_AUDIT_MODE)[keyof typeof LLM_RULE_JSON_DECISION_AUDIT_MODE];

// Zod schemas for LLM JSON output validation
export const llmToolPlanSchema = z.object({
  toolName: z.string().describe("The name of the tool to execute from the allowed tools list"),
  args: z.record(z.unknown()).describe("The arguments object - MUST contain all required fields extracted from user instructions. Example for sendEmail: {\"to\": \"email@example.com\", \"subject\": \"Subject text\", \"message\": \"Message text\"}"),
  rationale: z.string().describe("A concise, non-PHI reason for calling this tool")
});

export const llmRuleInfoSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  ruleVersion: z.string()
});

export const llmModelInfoSchema = z.object({
  name: z.string(),
  requestId: z.string()
});

export const llmRuleDecisionOutputSchema = z.object({
  referralId: z.string(),
  rule: llmRuleInfoSchema,
  decision: z.enum(["EXECUTE", "SKIP"]),
  reasonSummary: z.string(),
  confidence: z.number().min(0).max(1),
  tools: z.array(llmToolPlanSchema),
  model: llmModelInfoSchema
}).refine(
  (data) => {
    // If SKIP, tools must be empty; if EXECUTE, tools must be non-empty
    if (data.decision === "SKIP") {
      return data.tools.length === 0;
    }
    return data.tools.length > 0;
  },
  {
    message: "EXECUTE requires non-empty tools array; SKIP requires empty tools array"
  }
);

export type LlmToolPlan = z.infer<typeof llmToolPlanSchema>;
export type LlmRuleInfo = z.infer<typeof llmRuleInfoSchema>;
export type LlmModelInfo = z.infer<typeof llmModelInfoSchema>;
export type LlmRuleDecisionOutput = z.infer<typeof llmRuleDecisionOutputSchema>;

// Decision audit record type (for DB insert/update)
export type LlmRuleDecisionAuditRecord = {
  id?: string;
  siteId: string;
  referralId: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  decision: LlmDecision;
  confidence: number | null;
  reason: string | null;
  modelName: string | null;
  modelRequestId: string | null;
  validationStatus: LlmValidationStatus;
  validationError: string | null;
  // PHI Encryption fields (Envelope Encryption)
  // Each row has its own DEK wrapped by the tenant's public key
  rowDekWrapped?: Buffer | null;
  reasonCiphertext?: Buffer | null;
  reasonIv?: Buffer | null;
  reasonTag?: Buffer | null;
  basicReason?: string | null;
  reasonEncrypted?: boolean;
  createdAt?: Date;
};

export type NewLlmRuleDecisionAuditRecord = Omit<LlmRuleDecisionAuditRecord, "id" | "createdAt">;

// Tool execution audit record type (for DB insert/update)
export type LlmRuleToolExecutionAuditRecord = {
  id?: string;
  decisionAuditId: string;
  siteId: string;
  referralId: string;
  ruleId: string;
  toolIndex: number;
  toolName: string;
  argsHash: string | null;
  status: LlmToolExecutionStatus;
  errorCode: string | null;
  errorSummary: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt?: Date;
};

export type NewLlmRuleToolExecutionAuditRecord = Omit<LlmRuleToolExecutionAuditRecord, "id" | "createdAt">;

// Parsed and validated decision result
export type LlmDecisionParseResult = {
  success: true;
  data: LlmRuleDecisionOutput;
} | {
  success: false;
  validationStatus: LlmValidationStatus;
  validationError: string;
  rawOutput?: string;
};

// Helper to get feature flag mode from env
export function getLlmRuleJsonDecisionAuditMode(): LlmRuleJsonDecisionAuditMode {
  const mode = process.env.LLM_RULE_JSON_DECISION_AUDIT;
  if (mode === "SHADOW") return LLM_RULE_JSON_DECISION_AUDIT_MODE.SHADOW;
  if (mode === "ON") return LLM_RULE_JSON_DECISION_AUDIT_MODE.ON;
  return LLM_RULE_JSON_DECISION_AUDIT_MODE.OFF;
}

