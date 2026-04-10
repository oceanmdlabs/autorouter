import type {
  LlmRuleDecisionAuditRecord,
  NewLlmRuleDecisionAuditRecord,
  LlmRuleToolExecutionAuditRecord,
  NewLlmRuleToolExecutionAuditRecord,
  LlmToolExecutionStatus
} from "@/src/entities/models/llm-rule-decision";
import type { DecisionAuditFilters, DecisionAuditItem, RuleOption } from "@/src/entities/models/llm-audit-explorer";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";

export interface ILlmRuleDecisionAuditRepository {
  /**
   * Insert a new decision audit record
   * @returns The ID of the inserted record
   */
  create(record: NewLlmRuleDecisionAuditRecord): Promise<string>;

  /**
   * Get a decision audit record by ID
   */
  get(id: string): Promise<LlmRuleDecisionAuditRecord | null>;

  /**
   * Find decision audit records by referralId and optionally ruleId
   */
  findByReferralId(
    siteId: string,
    referralId: string,
    ruleId?: string
  ): Promise<LlmRuleDecisionAuditRecord[]>;

  /**
   * Get paginated decision audit records with filters
   * Includes embedded tool executions and derived fields
   */
  getPaginatedDecisions(
    siteId: string,
    filters: DecisionAuditFilters
  ): Promise<PaginatedResult<DecisionAuditItem>>;

  /**
   * Get distinct rules that have audit records for a site (for dropdown)
   */
  getDistinctRulesForSite(siteId: string): Promise<RuleOption[]>;

  /**
   * Find unencrypted decision audit records for a site (for migration)
   * @param siteId The site ID to query
   * @param limit Maximum number of records to return
   * @returns Records where reason_encrypted = FALSE and reason is not null
   */
  findUnencryptedForSite(siteId: string, limit?: number): Promise<LlmRuleDecisionAuditRecord[]>;

  /**
   * Update a record with encrypted reason data (envelope encryption)
   */
  updateWithEncryptedReason(
    id: string,
    data: {
      rowDekWrapped: Buffer;
      reasonCiphertext: Buffer;
      reasonIv: Buffer;
      reasonTag: Buffer;
      basicReason: string;
    }
  ): Promise<void>;

  /**
   * Count unencrypted records for a site
   */
  countUnencryptedForSite(siteId: string): Promise<number>;
}

export interface ILlmRuleToolExecutionAuditRepository {
  /**
   * Insert a new tool execution audit record
   * @returns The ID of the inserted record
   */
  create(record: NewLlmRuleToolExecutionAuditRecord): Promise<string>;

  /**
   * Bulk insert tool execution audit records (for planned tools)
   * @returns The IDs of the inserted records
   */
  createMany(records: NewLlmRuleToolExecutionAuditRecord[]): Promise<string[]>;

  /**
   * Update tool execution status with timestamps and error info
   */
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

  /**
   * Get tool execution audit records by decision audit ID
   */
  findByDecisionAuditId(decisionAuditId: string): Promise<LlmRuleToolExecutionAuditRecord[]>;

  /**
   * Get tool execution audit records for multiple decision audit IDs (batch query)
   */
  findByDecisionAuditIds(decisionAuditIds: string[]): Promise<LlmRuleToolExecutionAuditRecord[]>;

  /**
   * Get a tool execution audit record by ID
   */
  get(id: string): Promise<LlmRuleToolExecutionAuditRecord | null>;
}

