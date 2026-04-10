import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import type { DecisionAuditItem, DecisionAuditFilters } from "@/src/entities/models/llm-audit-explorer";
import type { LlmDecision, LlmValidationStatus, LlmToolExecutionStatus } from "@/src/entities/models/llm-rule-decision";

export default defineEventHandler(
  async (event): Promise<PaginatedResult<DecisionAuditItem>> => {
    const cxt = await toApplicationContext(event);
    const query = getQuery(event);

    // Get the siteId for the current tenant
    const siteId = await cxt.getSiteConfigurationRepository().getSiteIdForTenant();
    if (!siteId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Site configuration not found for this tenant'
      });
    }

    // Parse query parameters into filters
    const filters: DecisionAuditFilters = {
      referralId: query.referralId as string | undefined,
      ruleId: query.ruleId as string | undefined,
      from: query.from ? new Date(query.from as string) : undefined,
      to: query.to ? new Date(query.to as string) : undefined,
      decision: query.decision as LlmDecision | undefined,
      validationStatus: query.validationStatus as LlmValidationStatus | undefined,
      toolStatus: query.toolStatus as LlmToolExecutionStatus | undefined,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Math.min(Number(query.pageSize), 100) : 20,
      sort: (query.sort as DecisionAuditFilters['sort']) || 'createdAt_desc'
    };

    cxt.logger.debug(`fetching decisions for site ${siteId}`);
    cxt.logger.debug(`with filters: ${JSON.stringify(filters)}`);

    return await cxt.getLlmRuleDecisionAuditRepository().getPaginatedDecisions(siteId, filters);
  }
);

