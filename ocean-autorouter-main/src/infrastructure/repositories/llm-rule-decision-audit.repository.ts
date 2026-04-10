import type { ApplicationContext } from "@/src/entities/models/application-context";
import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import type {
  ILlmRuleDecisionAuditRepository,
  ILlmRuleToolExecutionAuditRepository
} from "@/src/application/repositories/llm-rule-decision-audit.repository.interface";
import {
  llmRuleDecisionAudit,
  llmRuleToolExecutionAudit
} from "@/drizzle/schema";
import type {
  LlmRuleDecisionAuditRecord,
  NewLlmRuleDecisionAuditRecord,
  LlmRuleToolExecutionAuditRecord,
  NewLlmRuleToolExecutionAuditRecord,
  LlmToolExecutionStatus
} from "@/src/entities/models/llm-rule-decision";
import type { DecisionAuditFilters, DecisionAuditItem, ToolExecutionItem, RuleOption } from "@/src/entities/models/llm-audit-explorer";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import { getToolDisplayName } from "@/src/entities/models/routing-tool";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createLlmRuleDecisionAuditRepository = ({
  cxt
}: Dependencies): ILlmRuleDecisionAuditRepository => {
  const dbService = cxt.getDbService();
  const phiCrypto = cxt.getPhiCryptoService();

  return {
    async create(record: NewLlmRuleDecisionAuditRecord): Promise<string> {
      // Check if tenant has encryption set up
      const siteConfigRepo = cxt.getSiteConfigurationRepository();
      const encryptionMaterial = await siteConfigRepo.getEncryptionMaterial(record.siteId);
      const isEncryptedSetup = encryptionMaterial?.isEncryptedSetup ?? false;

      // Base insert data
      const baseData = {
        siteId: record.siteId,
        referralId: record.referralId,
        ruleId: record.ruleId,
        ruleName: record.ruleName,
        ruleVersion: record.ruleVersion,
        decision: record.decision,
        confidence: record.confidence,
        modelName: record.modelName,
        modelRequestId: record.modelRequestId,
        validationStatus: record.validationStatus,
        validationError: record.validationError
      };

      if (isEncryptedSetup && encryptionMaterial?.publicKey) {
        // Tenant has encryption - use public key to seal (no clinic secret needed!)
        if (record.reason) {
          try {
            // Seal the reason using envelope encryption with public key
            const sealed = phiCrypto.seal(record.reason, encryptionMaterial.publicKey);
            const basicReason = phiCrypto.generateBasicReason(record.reason);

            const inserted = await dbService.insertGlobalReturning(
              llmRuleDecisionAudit,
              {
                ...baseData,
                reason: null, // Never store plaintext
                rowDekWrapped: sealed.wrappedDek,
                reasonCiphertext: sealed.ciphertext,
                reasonIv: sealed.iv,
                reasonTag: sealed.tag,
                basicReason,
                reasonEncrypted: true
              }
            );
            return inserted.id;
          } catch (error) {
            cxt.logger.error("Failed to encrypt reason - storing basic reason only", error);
            const basicReason = phiCrypto.generateBasicReason(record.reason);
            const inserted = await dbService.insertGlobalReturning(
              llmRuleDecisionAudit,
              {
                ...baseData,
                reason: null,
                basicReason,
                reasonEncrypted: false
              }
            );
            return inserted.id;
          }
        } else {
          // No reason to encrypt
          const inserted = await dbService.insertGlobalReturning(
            llmRuleDecisionAudit,
            {
              ...baseData,
              reason: null,
              basicReason: null,
              reasonEncrypted: true
            }
          );
          return inserted.id;
        }
      } else {
        // No encryption set up - store plaintext (legacy behavior)
        const inserted = await dbService.insertGlobalReturning(
          llmRuleDecisionAudit,
          {
            ...baseData,
            reason: record.reason,
            reasonEncrypted: false,
            basicReason: record.reason ? phiCrypto.generateBasicReason(record.reason) : null
          }
        );
        return inserted.id;
      }
    },

    async get(id: string): Promise<LlmRuleDecisionAuditRecord | null> {
      const result = await dbService.findFirstGlobal(llmRuleDecisionAudit, {
        where: eq(llmRuleDecisionAudit.id, id)
      });
      return result as LlmRuleDecisionAuditRecord | null;
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

      const results = await dbService.findManyGlobal(llmRuleDecisionAudit, {
        where: whereClause,
        orderBy: desc(llmRuleDecisionAudit.createdAt)
      });
      return results as LlmRuleDecisionAuditRecord[];
    },

    async getPaginatedDecisions(
      siteId: string,
      filters: DecisionAuditFilters
    ): Promise<PaginatedResult<DecisionAuditItem>> {
      const page = filters.page ?? 1;
      const pageSize = Math.min(filters.pageSize ?? 20, 100);
      const offset = (page - 1) * pageSize;

      // Build where conditions
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
      if (filters.validationStatus) {
        conditions.push(eq(llmRuleDecisionAudit.validationStatus, filters.validationStatus));
      }

      const whereClause = and(...conditions);
      const orderBy = filters.sort === 'createdAt_asc'
        ? asc(llmRuleDecisionAudit.createdAt)
        : desc(llmRuleDecisionAudit.createdAt);

      // Get total count
      const total = await dbService.countGlobal(llmRuleDecisionAudit, whereClause);

      // Get paginated decisions
      const decisions = await dbService.findManyGlobal(llmRuleDecisionAudit, {
        where: whereClause,
        orderBy,
        limit: pageSize,
        offset
      });

      if (decisions.length === 0) {
        return {
          items: [],
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        };
      }

      // Batch fetch tool executions for all decision IDs
      const decisionIds = decisions.map((d) => d.id);
      const toolExecutions = await dbService.findManyGlobal(llmRuleToolExecutionAudit, {
        where: inArray(llmRuleToolExecutionAudit.decisionAuditId, decisionIds),
        orderBy: asc(llmRuleToolExecutionAudit.toolIndex)
      });

      // Group tool executions by decision audit ID
      const toolsByDecisionId = new Map<string, LlmRuleToolExecutionAuditRecord[]>();
      for (const tool of toolExecutions) {
        const existing = toolsByDecisionId.get(tool.decisionAuditId) || [];
        existing.push(tool as LlmRuleToolExecutionAuditRecord);
        toolsByDecisionId.set(tool.decisionAuditId, existing);
      }

      // Filter by tool status if specified
      let filteredDecisionIds: Set<string> | null = null;
      if (filters.toolStatus) {
        filteredDecisionIds = new Set<string>();
        for (const [decisionId, tools] of toolsByDecisionId) {
          if (tools.some((t) => t.status === filters.toolStatus)) {
            filteredDecisionIds.add(decisionId);
          }
        }
      }

      // Check if we have a private key in session for decryption
      const session = cxt.getSession();
      const privateKey = session?.tenantPrivateKey ?? null;

      // Build result items
      const items: DecisionAuditItem[] = decisions
        .filter((d) => !filteredDecisionIds || filteredDecisionIds.has(d.id))
        .map((d) => {
          const tools = toolsByDecisionId.get(d.id) || [];
          const toolItems: ToolExecutionItem[] = tools.map((t) => ({
            toolExecutionId: t.id!,
            toolIndex: t.toolIndex,
            toolName: t.toolName,
            toolDisplayName: getToolDisplayName(t.toolName),
            status: t.status,
            errorCode: t.errorCode,
            errorSummary: t.errorSummary,
            startedAt: t.startedAt,
            finishedAt: t.finishedAt,
            createdAt: t.createdAt!,
            durationMs: t.startedAt && t.finishedAt
              ? t.finishedAt.getTime() - t.startedAt.getTime()
              : null
          }));

          const toolFailedCount = tools.filter((t) => t.status === 'FAILED').length;
          const hasValidationError = !!d.validationError || (d.validationStatus !== 'VALID');

          // Handle reason decryption using asymmetric model
          let displayReason: string | null = d.reason;
          const reasonEncrypted = d.reasonEncrypted ?? false;
          const basicReason = d.basicReason ?? null;

          if (reasonEncrypted && d.rowDekWrapped && d.reasonCiphertext && d.reasonIv && d.reasonTag) {
            // Record is encrypted with envelope encryption
            if (privateKey) {
              // We have the private key - try to decrypt using "open"
              try {
                displayReason = phiCrypto.open({
                  wrappedDek: d.rowDekWrapped,
                  ciphertext: d.reasonCiphertext,
                  iv: d.reasonIv,
                  tag: d.reasonTag
                }, privateKey);
              } catch (error) {
                cxt.logger.warn(`Failed to decrypt reason for audit ${d.id}`);
                displayReason = null;
              }
            } else {
              // No private key available - reason stays null, UI will show encrypted indicator
              displayReason = null;
            }
          }

          return {
            decisionAuditId: d.id,
            siteId: d.siteId,
            referralId: d.referralId,
            ruleId: d.ruleId,
            ruleName: d.ruleName,
            ruleVersion: d.ruleVersion,
            decision: d.decision,
            confidence: d.confidence,
            reason: displayReason,
            basicReason,
            reasonEncrypted,
            modelName: d.modelName,
            modelRequestId: d.modelRequestId,
            validationStatus: d.validationStatus,
            validationError: d.validationError,
            createdAt: d.createdAt,
            toolExecutions: toolItems,
            toolCount: tools.length,
            toolFailedCount,
            hasErrors: hasValidationError || toolFailedCount > 0
          };
        });

      return {
        items,
        total: filteredDecisionIds ? items.length : total,
        page,
        pageSize,
        totalPages: Math.ceil((filteredDecisionIds ? items.length : total) / pageSize)
      };
    },

    async getDistinctRulesForSite(siteId: string): Promise<RuleOption[]> {
      const results = await dbService.findManyGlobal(llmRuleDecisionAudit, {
        where: eq(llmRuleDecisionAudit.siteId, siteId)
      });

      // Deduplicate by ruleId
      const ruleMap = new Map<string, RuleOption>();
      for (const r of results) {
        if (!ruleMap.has(r.ruleId)) {
          ruleMap.set(r.ruleId, {
            ruleId: r.ruleId,
            ruleName: r.ruleName,
            ruleVersion: r.ruleVersion
          });
        }
      }

      return Array.from(ruleMap.values()).sort((a, b) => a.ruleName.localeCompare(b.ruleName));
    },

    async findUnencryptedForSite(siteId: string, limit: number = 100): Promise<LlmRuleDecisionAuditRecord[]> {
      const whereClause = and(
        eq(llmRuleDecisionAudit.siteId, siteId),
        eq(llmRuleDecisionAudit.reasonEncrypted, false)
      );

      const results = await dbService.findManyGlobal(llmRuleDecisionAudit, {
        where: whereClause,
        orderBy: asc(llmRuleDecisionAudit.createdAt),
        limit
      });

      return results as LlmRuleDecisionAuditRecord[];
    },

    async updateWithEncryptedReason(
      id: string,
      data: {
        rowDekWrapped: Buffer;
        reasonCiphertext: Buffer;
        reasonIv: Buffer;
        reasonTag: Buffer;
        basicReason: string;
      }
    ): Promise<void> {
      await dbService.updateGlobal(
        llmRuleDecisionAudit,
        {
          rowDekWrapped: data.rowDekWrapped,
          reasonCiphertext: data.reasonCiphertext,
          reasonIv: data.reasonIv,
          reasonTag: data.reasonTag,
          basicReason: data.basicReason,
          reasonEncrypted: true,
          // Null out the original plaintext reason after successful encryption
          reason: null
        },
        eq(llmRuleDecisionAudit.id, id)
      );
    },

    async countUnencryptedForSite(siteId: string): Promise<number> {
      const whereClause = and(
        eq(llmRuleDecisionAudit.siteId, siteId),
        eq(llmRuleDecisionAudit.reasonEncrypted, false)
      );

      return await dbService.countGlobal(llmRuleDecisionAudit, whereClause);
    }
  };
};

export const createLlmRuleToolExecutionAuditRepository = ({
  cxt
}: Dependencies): ILlmRuleToolExecutionAuditRepository => {
  const dbService = cxt.getDbService();

  return {
    async create(record: NewLlmRuleToolExecutionAuditRecord): Promise<string> {
      const inserted = await dbService.insertGlobalReturning(
        llmRuleToolExecutionAudit,
        {
          decisionAuditId: record.decisionAuditId,
          siteId: record.siteId,
          referralId: record.referralId,
          ruleId: record.ruleId,
          toolIndex: record.toolIndex,
          toolName: record.toolName,
          argsHash: record.argsHash,
          status: record.status,
          errorCode: record.errorCode,
          errorSummary: record.errorSummary,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt
        }
      );
      return inserted.id;
    },

    async createMany(
      records: NewLlmRuleToolExecutionAuditRecord[]
    ): Promise<string[]> {
      if (records.length === 0) return [];

      const values = records.map((record) => ({
        decisionAuditId: record.decisionAuditId,
        siteId: record.siteId,
        referralId: record.referralId,
        ruleId: record.ruleId,
        toolIndex: record.toolIndex,
        toolName: record.toolName,
        argsHash: record.argsHash,
        status: record.status,
        errorCode: record.errorCode,
        errorSummary: record.errorSummary,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt
      }));

      const inserted = await dbService.insertGlobalReturningMany(
        llmRuleToolExecutionAudit,
        values
      );
      return inserted.map((r) => r.id);
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
      await dbService.updateGlobal(
        llmRuleToolExecutionAudit,
        {
          status,
          ...updates
        },
        eq(llmRuleToolExecutionAudit.id, id)
      );
    },

    async findByDecisionAuditId(
      decisionAuditId: string
    ): Promise<LlmRuleToolExecutionAuditRecord[]> {
      const results = await dbService.findManyGlobal(llmRuleToolExecutionAudit, {
        where: eq(llmRuleToolExecutionAudit.decisionAuditId, decisionAuditId)
      });
      return results as LlmRuleToolExecutionAuditRecord[];
    },

    async findByDecisionAuditIds(
      decisionAuditIds: string[]
    ): Promise<LlmRuleToolExecutionAuditRecord[]> {
      if (decisionAuditIds.length === 0) return [];

      const results = await dbService.findManyGlobal(llmRuleToolExecutionAudit, {
        where: inArray(llmRuleToolExecutionAudit.decisionAuditId, decisionAuditIds),
        orderBy: asc(llmRuleToolExecutionAudit.toolIndex)
      });
      return results as LlmRuleToolExecutionAuditRecord[];
    },

    async get(id: string): Promise<LlmRuleToolExecutionAuditRecord | null> {
      const result = await dbService.findFirstGlobal(llmRuleToolExecutionAudit, {
        where: eq(llmRuleToolExecutionAudit.id, id)
      });
      return result as LlmRuleToolExecutionAuditRecord | null;
    }
  };
};

