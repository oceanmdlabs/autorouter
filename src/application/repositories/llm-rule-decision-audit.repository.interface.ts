import type {
  DecisionAuditFilters,
  DecisionAuditItem,
  RuleOption,
} from "@/src/entities/models/llm-audit-explorer";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import type {
  LlmRuleDecisionAuditRecord,
  LlmRuleToolExecutionAuditRecord,
  LlmToolExecutionStatus,
  NewLlmRuleDecisionAuditRecord,
  NewLlmRuleToolExecutionAuditRecord,
} from "@/src/entities/models/llm-rule-decision";

export interface ILlmRuleDecisionAuditRepository {
  create(record: NewLlmRuleDecisionAuditRecord): Promise<string>;
  get(id: string): Promise<LlmRuleDecisionAuditRecord | null>;
  findByReferralId(
    siteId: string,
    referralId: string,
    ruleId?: string
  ): Promise<LlmRuleDecisionAuditRecord[]>;
  getPaginatedDecisions(
    siteId: string,
    filters: DecisionAuditFilters
  ): Promise<PaginatedResult<DecisionAuditItem>>;
  getDistinctRulesForSite(siteId: string): Promise<RuleOption[]>;
}

export interface ILlmRuleToolExecutionAuditRepository {
  create(record: NewLlmRuleToolExecutionAuditRecord): Promise<string>;
  createMany(records: NewLlmRuleToolExecutionAuditRecord[]): Promise<string[]>;
  updateStatus(
    id: string,
    status: LlmToolExecutionStatus,
    updates: {
      errorCode?: string | null;
      errorSummary?: string | null;
      startedAt?: Date | null;
      finishedAt?: Date | null;
    }
  ): Promise<void>;
  findByDecisionAuditId(
    decisionAuditId: string
  ): Promise<LlmRuleToolExecutionAuditRecord[]>;
  findByDecisionAuditIds(
    decisionAuditIds: string[]
  ): Promise<LlmRuleToolExecutionAuditRecord[]>;
  get(id: string): Promise<LlmRuleToolExecutionAuditRecord | null>;
}
