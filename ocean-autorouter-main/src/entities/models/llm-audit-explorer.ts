import type { LlmDecision, LlmValidationStatus, LlmToolExecutionStatus } from "./llm-rule-decision";

/**
 * Filter options for querying decision audit records
 */
export type DecisionAuditFilters = {
  referralId?: string;
  ruleId?: string;
  from?: Date;
  to?: Date;
  decision?: LlmDecision;
  validationStatus?: LlmValidationStatus;
  toolStatus?: LlmToolExecutionStatus; // e.g., FAILED to filter rows with failed tools
  page?: number;
  pageSize?: number;
  sort?: 'createdAt_asc' | 'createdAt_desc';
};

/**
 * Tool execution item in the audit explorer
 */
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
  /** Duration in milliseconds (computed) */
  durationMs: number | null;
};

/**
 * Decision audit item with embedded tool executions
 */
export type DecisionAuditItem = {
  decisionAuditId: string;
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
  createdAt: Date;

  // PHI Encryption fields
  basicReason: string | null;
  reasonEncrypted: boolean;

  // Embedded tool executions
  toolExecutions: ToolExecutionItem[];

  // Derived fields (computed server-side)
  toolCount: number;
  toolFailedCount: number;
  hasErrors: boolean;
};

/**
 * Rule option for the filter dropdown
 */
export type RuleOption = {
  ruleId: string;
  ruleName: string;
  ruleVersion?: string;
};

