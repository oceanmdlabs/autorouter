import type {
  LlmDecision,
  LlmToolExecutionStatus,
} from "./llm-rule-decision";

export type DecisionAuditFilters = {
  referralId?: string;
  ruleId?: string;
  from?: Date;
  to?: Date;
  decision?: LlmDecision;
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
  actionType: string | null;
  toolInput: Record<string, unknown> | null;
  toolResult: string | null;
  status: LlmToolExecutionStatus;
  errorCode: string | null;
  errorSummary: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  durationMs: number | null;
};

export type AuditAction = {
  tool: string;
  actionType: string | null;
  input: Record<string, unknown> | null;
  result: string | null;
};

export type DecisionAuditItem = {
  decisionAuditId: string;
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
  createdAt: Date;
  actions: AuditAction[];
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
