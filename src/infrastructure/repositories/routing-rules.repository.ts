import { ApplicationContext } from "@/src/entities/models/application-context";
import { eq } from "drizzle-orm";
import { routingRules } from "@/drizzle/schema";
import type {
  NewRoutingRule,
  RoutingRule,
} from "@/src/entities/models/routing-rule";
import type { IRoutingRulesRepository } from "@/src/application/repositories/routing-rules.repository.interface";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createRoutingRulesRepository = ({
  cxt,
}: Dependencies): IRoutingRulesRepository => {
  const db = cxt.getDbService().getDb();
  return {
    async getAllAtTenant(): Promise<RoutingRule[]> {
      const results = await db.query.routingRules.findMany({
        where: eq(routingRules.tenantId, cxt.getNonEmptyTenantId()),
      });
      return results.map((rule) => ({
        ...rule,
        enabledTools: (rule.enabledTools || []) as RoutingToolName[],
      }));
    },

    async get(id: string): Promise<RoutingRule | null> {
      const result = await db.query.routingRules.findFirst({
        where: eq(routingRules.id, id),
      });
      if (!result) return null;
      return {
        ...result,
        enabledTools: (result.enabledTools || []) as RoutingToolName[],
      };
    },

    async create(record: NewRoutingRule) {
      await db
        .insert(routingRules)
        .values(cxt.getDbService().initMetadataAndTenant(record));
    },

    async update(record) {
      cxt.getDbService().updateMetadata(record);
      await db
        .update(routingRules)
        .set(record)
        .where(eq(routingRules.id, record.id));
    },

    async remove(id) {
      await db.delete(routingRules).where(eq(routingRules.id, id));
    },
  };
};
