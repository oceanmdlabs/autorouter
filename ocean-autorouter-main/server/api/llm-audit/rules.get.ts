import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { RuleOption } from "@/src/entities/models/llm-audit-explorer";

export default defineEventHandler(
  async (event): Promise<RuleOption[]> => {
    const cxt = await toApplicationContext(event);

    // Get the siteId for the current tenant
    const siteId = await cxt.getSiteConfigurationRepository().getSiteIdForTenant();
    if (!siteId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Site configuration not found for this tenant'
      });
    }

    cxt.logger.debug(`fetching rules for site ${siteId}`);

    return await cxt.getLlmRuleDecisionAuditRepository().getDistinctRulesForSite(siteId);
  }
);

