import type {
  ILlmRuleDecisionAuditRepository,
  ILlmRuleToolExecutionAuditRepository,
} from "@/src/application/repositories/llm-rule-decision-audit.repository.interface";
import type {
  DecisionAuditFilters,
  DecisionAuditItem,
  RuleOption,
  ToolExecutionItem,
} from "@/src/entities/models/llm-audit-explorer";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import { clientRoutingToolRegistry } from "@/src/entities/models/routing-tool-client";
import type {
  LlmRuleDecisionAuditRecord,
  LlmRuleToolExecutionAuditRecord,
  LlmToolExecutionStatus,
  NewLlmRuleDecisionAuditRecord,
  NewLlmRuleToolExecutionAuditRecord,
} from "@/src/entities/models/llm-rule-decision";
import {
  llmRuleDecisionAudit,
  llmRuleToolExecutionAudit,
} from "@/drizzle/schema";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createLlmRuleDecisionAuditRepository = ({
  cxt,
}: Dependencies): ILlmRuleDecisionAuditRepository => {
  const dbService = cxt.getDbService();

  return {
    async create(record: NewLlmRuleDecisionAuditRecord): Promise<string> {
      const inserted = dbService.initMetadataAndTenant({
        siteId: record.siteId,
        referralId: record.referralId,
        ruleId: record.ruleId,
        ruleName: record.ruleName,
        ruleVersion: record.ruleVersion,
        confidence: record.confidence,
        reasonSummary: record.reasonSummary,
        modelName: record.modelName,
        modelRequestId: record.modelRequestId,
        validationError: record.validationError,
        decision: sql`${record.decision}::llm_decision`,
        reasonCode: record.reasonCode ? sql`${record.reasonCode}::llm_reason_code` : null,
        validationStatus: sql`${record.validationStatus}::llm_validation_status`,
      });
      await dbService.insert(llmRuleDecisionAudit, inserted);
      return inserted.id;
    },

    async get(id: string): Promise<LlmRuleDecisionAuditRecord | null> {
      return (await dbService.findFirst(llmRuleDecisionAudit, {
        where: eq(llmRuleDecisionAudit.id, id),
      })) as LlmRuleDecisionAuditRecord | null;
    },

    async findByReferralId(
      siteId: string,
      referralId: string,
      ruleId?: string
    ): Promise<LlmRuleDecisionAuditRecord[]> {
      const whereClause = ruleId
        ? and(
            eq(llmRuleDecisionAudit.siteId, siteId),
            eq(llmRuleDecisionAudit.referralId, referralId),
            eq(llmRuleDecisionAudit.ruleId, ruleId)
          )
        : and(
            eq(llmRuleDecisionAudit.siteId, siteId),
            eq(llmRuleDecisionAudit.referralId, referralId)
          );

      return (await dbService.findMany(llmRuleDecisionAudit, {
        where: whereClause,
        orderBy: desc(llmRuleDecisionAudit.createdAt),
      })) as LlmRuleDecisionAuditRecord[];
    },

    async getPaginatedDecisions(
      siteId: string,
      filters: DecisionAuditFilters
    ): Promise<PaginatedResult<DecisionAuditItem>> {
      const page = filters.page ?? 1;
      const pageSize = Math.min(filters.pageSize ?? 20, 100);
      const offset = (page - 1) * pageSize;

      const conditions = [eq(llmRuleDecisionAudit.siteId, siteId)];

      if (filters.referralId) {
        conditions.push(eq(llmRuleDecisionAudit.referralId, filters.referralId));
      }
      if (filters.ruleId) {
        conditions.push(eq(llmRuleDecisionAudit.ruleId, filters.ruleId));
      }
      if (filters.from) {
        conditions.push(gte(llmRuleDecisionAudit.createdAt, filters.from));
      }
      if (filters.to) {
        conditions.push(lte(llmRuleDecisionAudit.createdAt, filters.to));
      }
      if (filters.decision) {
        conditions.push(eq(llmRuleDecisionAudit.decision, filters.decision));
      }
      if (filters.reasonCode) {
        conditions.push(eq(llmRuleDecisionAudit.reasonCode, filters.reasonCode));
      }
      if (filters.validationStatus) {
        conditions.push(
          eq(llmRuleDecisionAudit.validationStatus, filters.validationStatus)
        );
      }

      const whereClause = and(...conditions);
      const orderBy =
        filters.sort === "createdAt_asc"
          ? asc(llmRuleDecisionAudit.createdAt)
          : desc(llmRuleDecisionAudit.createdAt);

      const total = await dbService.count(llmRuleDecisionAudit, {
        where: whereClause,
      });

      const decisions = (await dbService.findMany(llmRuleDecisionAudit, {
        where: whereClause,
        orderBy,
        limit: pageSize,
        offset,
      })) as LlmRuleDecisionAuditRecord[];

      if (decisions.length === 0) {
        return {
          items: [],
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }

      const decisionIds = decisions.flatMap((decision) =>
        decision.id ? [decision.id] : []
      );

      const toolExecutions =
        decisionIds.length === 0
          ? []
          : ((await dbService.findMany(llmRuleToolExecutionAudit, {
              where: inArray(llmRuleToolExecutionAudit.decisionAuditId, decisionIds),
              orderBy: asc(llmRuleToolExecutionAudit.toolIndex),
            })) as LlmRuleToolExecutionAuditRecord[]);

      const toolsByDecisionId = new Map<string, LlmRuleToolExecutionAuditRecord[]>();
      for (const tool of toolExecutions) {
        const existing = toolsByDecisionId.get(tool.decisionAuditId) ?? [];
        existing.push(tool);
        toolsByDecisionId.set(tool.decisionAuditId, existing);
      }

      let filteredDecisionIds: Set<string> | null = null;
      if (filters.toolStatus) {
        filteredDecisionIds = new Set<string>();
        for (const [decisionId, tools] of toolsByDecisionId) {
          if (tools.some((tool) => tool.status === filters.toolStatus)) {
            filteredDecisionIds.add(decisionId);
          }
        }
      }

      const items: DecisionAuditItem[] = decisions
        .filter((decision) => {
          if (!filteredDecisionIds) return true;
          return decision.id ? filteredDecisionIds.has(decision.id) : false;
        })
        .map((decision) => {
          const tools = decision.id
            ? toolsByDecisionId.get(decision.id) ?? []
            : [];

          const toolItems: ToolExecutionItem[] = tools.map((tool) => {
            const toolDisplay =
              clientRoutingToolRegistry[
                tool.toolName as keyof typeof clientRoutingToolRegistry
              ];

            return {
              toolExecutionId: tool.id!,
              toolIndex: tool.toolIndex,
              toolName: tool.toolName,
              toolDisplayName:
                toolDisplay?.briefDescription ??
                toolDisplay?.description ??
                tool.toolName,
              status: tool.status,
              errorCode: tool.errorCode,
              errorSummary: tool.errorSummary,
              startedAt: tool.startedAt,
              finishedAt: tool.finishedAt,
              createdAt: tool.createdAt!,
              durationMs:
                tool.startedAt && tool.finishedAt
                  ? tool.finishedAt.getTime() - tool.startedAt.getTime()
                  : null,
            };
          });

          const toolFailedCount = tools.filter(
            (tool) => tool.status === "FAILED"
          ).length;
          const hasValidationError =
            !!decision.validationError || decision.validationStatus !== "VALID";

          return {
            decisionAuditId: decision.id!,
            tenantId: decision.tenantId,
            siteId: decision.siteId,
            referralId: decision.referralId,
            ruleId: decision.ruleId,
            ruleName: decision.ruleName,
            ruleVersion: decision.ruleVersion,
            decision: decision.decision,
            confidence: decision.confidence,
            reasonCode: decision.reasonCode,
            reasonSummary: decision.reasonSummary,
            modelName: decision.modelName,
            modelRequestId: decision.modelRequestId,
            validationStatus: decision.validationStatus,
            validationError: decision.validationError,
            createdAt: decision.createdAt!,
            toolExecutions: toolItems,
            toolCount: tools.length,
            toolFailedCount,
            hasErrors: hasValidationError || toolFailedCount > 0,
          };
        });

      const resultTotal = filteredDecisionIds ? items.length : total;

      return {
        items,
        total: resultTotal,
        page,
        pageSize,
        totalPages: Math.ceil(resultTotal / pageSize),
      };
    },

    async getDistinctRulesForSite(siteId: string): Promise<RuleOption[]> {
      const results = (await dbService.findMany(llmRuleDecisionAudit, {
        where: eq(llmRuleDecisionAudit.siteId, siteId),
        orderBy: desc(llmRuleDecisionAudit.createdAt),
      })) as LlmRuleDecisionAuditRecord[];

      const seen = new Set<string>();
      const distinctRules: RuleOption[] = [];

      for (const result of results) {
        const key = `${result.ruleId}:${result.ruleVersion}`;
        if (seen.has(key)) continue;
        seen.add(key);
        distinctRules.push({
          ruleId: result.ruleId,
          ruleName: result.ruleName,
          ruleVersion: result.ruleVersion,
        });
      }

      return distinctRules;
    },
  };
};

export const createLlmRuleToolExecutionAuditRepository = ({
  cxt,
}: Dependencies): ILlmRuleToolExecutionAuditRepository => {
  const dbService = cxt.getDbService();

  return {
    async create(record: NewLlmRuleToolExecutionAuditRecord): Promise<string> {
      const inserted = dbService.initMetadataAndTenant({
        decisionAuditId: record.decisionAuditId,
        siteId: record.siteId,
        referralId: record.referralId,
        ruleId: record.ruleId,
        toolIndex: record.toolIndex,
        toolName: record.toolName,
        argsHash: record.argsHash,
        errorCode: record.errorCode,
        errorSummary: record.errorSummary,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        status: sql`${record.status}::llm_tool_execution_status`,
      });
      await dbService.insert(llmRuleToolExecutionAudit, inserted);
      return inserted.id;
    },

    async createMany(
      records: NewLlmRuleToolExecutionAuditRecord[]
    ): Promise<string[]> {
      const inserted = records.map((record) =>
        dbService.initMetadataAndTenant({
          decisionAuditId: record.decisionAuditId,
          siteId: record.siteId,
          referralId: record.referralId,
          ruleId: record.ruleId,
          toolIndex: record.toolIndex,
          toolName: record.toolName,
          argsHash: record.argsHash,
          errorCode: record.errorCode,
          errorSummary: record.errorSummary,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt,
          status: sql`${record.status}::llm_tool_execution_status`,
        })
      );
      for (const row of inserted) {
        await dbService.insert(llmRuleToolExecutionAudit, row);
      }
      return inserted.map((row) => row.id);
    },

    async updateStatus(
      id: string,
      status: LlmToolExecutionStatus,
      updates: {
        errorCode?: string | null;
        errorSummary?: string | null;
        startedAt?: Date | null;
        finishedAt?: Date | null;
      }
    ): Promise<void> {
      const existing = await dbService.findFirst(llmRuleToolExecutionAudit, {
        where: eq(llmRuleToolExecutionAudit.id, id),
      });

      if (!existing) {
        throw new Error(`Tool execution audit record not found: ${id}`);
      }

      const nextRecord = {
        ...existing,
        status: sql`${status}::llm_tool_execution_status`,
        errorCode: updates.errorCode ?? existing.errorCode,
        errorSummary: updates.errorSummary ?? existing.errorSummary,
        startedAt: updates.startedAt ?? existing.startedAt,
        finishedAt: updates.finishedAt ?? existing.finishedAt,
      };
      dbService.updateMetadata(nextRecord);

      await dbService.update(
        llmRuleToolExecutionAudit,
        nextRecord,
        eq(llmRuleToolExecutionAudit.id, id)
      );
    },

    async findByDecisionAuditId(
      decisionAuditId: string
    ): Promise<LlmRuleToolExecutionAuditRecord[]> {
      return (await dbService.findMany(llmRuleToolExecutionAudit, {
        where: eq(llmRuleToolExecutionAudit.decisionAuditId, decisionAuditId),
        orderBy: asc(llmRuleToolExecutionAudit.toolIndex),
      })) as LlmRuleToolExecutionAuditRecord[];
    },

    async findByDecisionAuditIds(
      decisionAuditIds: string[]
    ): Promise<LlmRuleToolExecutionAuditRecord[]> {
      if (decisionAuditIds.length === 0) return [];

      return (await dbService.findMany(llmRuleToolExecutionAudit, {
        where: inArray(llmRuleToolExecutionAudit.decisionAuditId, decisionAuditIds),
        orderBy: asc(llmRuleToolExecutionAudit.toolIndex),
      })) as LlmRuleToolExecutionAuditRecord[];
    },

    async get(id: string): Promise<LlmRuleToolExecutionAuditRecord | null> {
      return (await dbService.findFirst(llmRuleToolExecutionAudit, {
        where: eq(llmRuleToolExecutionAudit.id, id),
      })) as LlmRuleToolExecutionAuditRecord | null;
    },
  };
};
