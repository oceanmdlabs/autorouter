import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { DecisionAuditFilters } from "@/src/entities/models/llm-audit-explorer";
import type { LlmDecision } from "@/src/entities/models/llm-rule-decision";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const query = getQuery(event);

  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  if (!siteConfig?.id) {
    return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
  }

  const filters: DecisionAuditFilters = {
    referralId: query.referralId as string | undefined,
    ruleId: query.ruleId as string | undefined,
    decision: query.decision as LlmDecision | undefined,
    from: query.from ? new Date(query.from as string) : undefined,
    to: query.to ? new Date(query.to as string) : undefined,
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    sort: (query.sort as DecisionAuditFilters["sort"]) ?? "createdAt_desc",
  };

  return await cxt.getLlmRuleDecisionAuditRepository().getPaginatedDecisions(siteConfig.id, filters);
});
