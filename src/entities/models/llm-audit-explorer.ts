import type {
  LlmDecision,
  LlmReasonCode,
  LlmToolExecutionStatus,
  LlmValidationStatus,
} from "./llm-rule-decision";

export type DecisionAuditFilters = {
  referralId?: string;
  ruleId?: string;
  from?: Date;
  to?: Date;
  decision?: LlmDecision;
  reasonCode?: LlmReasonCode;
  validationStatus?: LlmValidationStatus;
  toolStatus?: LlmToolExecutionStatus;
  page?: number;
  pageSize?: number;
  sort?: "createdAt_asc" | "createdAt_desc";
};

export type ToolExecutionItem = {
  toolExecutionId: string;
  toolIndex: number;
  toolName: string;
  toolDisplayName: string;
  status: LlmToolExecutionStatus;
  errorCode: string | null;
  errorSummary: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  durationMs: number | null;
};

export type DecisionAuditItem = {
  decisionAuditId: string;
  tenantId: string;
  siteId: string;
  referralId: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  decision: LlmDecision;
  confidence: number | null;
  reasonCode: LlmReasonCode | null;
  reasonSummary: string | null;
  modelName: string | null;
  modelRequestId: string | null;
  validationStatus: LlmValidationStatus;
  validationError: string | null;
  createdAt: Date;
  toolExecutions: ToolExecutionItem[];
  toolCount: number;
  toolFailedCount: number;
  hasErrors: boolean;
};

export type RuleOption = {
  ruleId: string;
  ruleName: string;
  ruleVersion?: string;
};
