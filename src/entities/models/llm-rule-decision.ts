import { z } from "zod";

export const LLM_DECISION = {
  EXECUTE: "EXECUTE",
  SKIP: "SKIP",
  ERROR: "ERROR",
} as const;

export type LlmDecision =
  (typeof LLM_DECISION)[keyof typeof LLM_DECISION];

export const LLM_VALIDATION_STATUS = {
  VALID: "VALID",
  INVALID_JSON: "INVALID_JSON",
  INVALID_SCHEMA: "INVALID_SCHEMA",
  DISALLOWED_CONTENT: "DISALLOWED_CONTENT",
  OTHER: "OTHER",
} as const;

export type LlmValidationStatus =
  (typeof LLM_VALIDATION_STATUS)[keyof typeof LLM_VALIDATION_STATUS];

export const LLM_TOOL_EXECUTION_STATUS = {
  PLANNED: "PLANNED",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

export type LlmToolExecutionStatus =
  (typeof LLM_TOOL_EXECUTION_STATUS)[keyof typeof LLM_TOOL_EXECUTION_STATUS];

export const LLM_RULE_JSON_DECISION_AUDIT_MODE = {
  OFF: "OFF",
  SHADOW: "SHADOW",
  ON: "ON",
} as const;

export type LlmRuleJsonDecisionAuditMode =
  (typeof LLM_RULE_JSON_DECISION_AUDIT_MODE)[keyof typeof LLM_RULE_JSON_DECISION_AUDIT_MODE];

export const llmReasonCodes = [
  "ROUTING_RULE_MATCHED",
  "NO_ACTION_NEEDED",
  "MISSING_INFORMATION",
  "OUTSIDE_SCOPE",
  "PATIENT_OPT_OUT",
  "VALIDATION_FAILED",
  "MODEL_ERROR",
] as const;

export type LlmReasonCode = (typeof llmReasonCodes)[number];

export const llmReasonCodeSummaryMap: Record<LlmReasonCode, string> = {
  ROUTING_RULE_MATCHED: "The rule conditions were met.",
  NO_ACTION_NEEDED: "No follow-up action is needed.",
  MISSING_INFORMATION: "Required information is missing.",
  OUTSIDE_SCOPE: "The request falls outside the rule scope.",
  PATIENT_OPT_OUT: "Processing was skipped because the patient opted out.",
  VALIDATION_FAILED: "The model output did not pass validation.",
  MODEL_ERROR: "The model evaluation did not complete successfully.",
};

export const llmToolPlanSchema = z.object({
  toolName: z.string(),
  args: z.record(z.unknown()),
});

export const llmRuleInfoSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  ruleVersion: z.string(),
});

export const llmModelInfoSchema = z.object({
  name: z.string(),
  requestId: z.string(),
});

export const llmRuleDecisionOutputSchema = z
  .object({
    referralId: z.string(),
    rule: llmRuleInfoSchema,
    decision: z.enum(["EXECUTE", "SKIP"]),
    reasonCode: z.enum(llmReasonCodes),
    confidence: z.number().min(0).max(1),
    tools: z.array(llmToolPlanSchema),
    model: llmModelInfoSchema,
  })
  .refine(
    (data) => {
      if (data.decision === "SKIP") {
        return data.tools.length === 0;
      }
      return data.tools.length > 0;
    },
    {
      message:
        "EXECUTE requires non-empty tools array; SKIP requires empty tools array",
    }
  );

export type LlmToolPlan = z.infer<typeof llmToolPlanSchema>;
export type LlmRuleInfo = z.infer<typeof llmRuleInfoSchema>;
export type LlmModelInfo = z.infer<typeof llmModelInfoSchema>;
export type LlmRuleDecisionOutput = z.infer<
  typeof llmRuleDecisionOutputSchema
>;

export type LlmRuleDecisionAuditRecord = {
  id?: string;
  tenantId: string;
  siteId: string;
  referralId: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  triggered: boolean;
  decision: LlmDecision;
  reasonSummary: string | null;
  reasoning: string | null;
  validationError: string | null;
  createdAt?: Date;
};

export type NewLlmRuleDecisionAuditRecord = Omit<
  LlmRuleDecisionAuditRecord,
  "id" | "createdAt"
>;

export type LlmRuleToolExecutionAuditRecord = {
  id?: string;
  tenantId: string;
  decisionAuditId: string;
  siteId: string;
  referralId: string;
  ruleId: string;
  toolIndex: number;
  toolName: string;
  argsHash: string | null;
  toolInput: Record<string, unknown> | null;
  toolResult: string | null;
  actionType: string | null;
  status: LlmToolExecutionStatus;
  errorCode: string | null;
  errorSummary: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt?: Date;
};

export type NewLlmRuleToolExecutionAuditRecord = Omit<
  LlmRuleToolExecutionAuditRecord,
  "id" | "createdAt"
>;

export type LlmDecisionParseResult =
  | {
      success: true;
      data: LlmRuleDecisionOutput;
    }
  | {
      success: false;
      validationStatus: LlmValidationStatus;
      validationError: string;
      rawOutput?: string;
    };

export function getLlmRuleJsonDecisionAuditMode(): LlmRuleJsonDecisionAuditMode {
  const mode = process.env.LLM_RULE_JSON_DECISION_AUDIT;
  if (mode === "SHADOW") return LLM_RULE_JSON_DECISION_AUDIT_MODE.SHADOW;
  if (mode === "ON") return LLM_RULE_JSON_DECISION_AUDIT_MODE.ON;
  return LLM_RULE_JSON_DECISION_AUDIT_MODE.OFF;
}
