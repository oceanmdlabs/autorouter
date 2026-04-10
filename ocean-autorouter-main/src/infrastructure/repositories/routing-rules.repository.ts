import type { ApplicationContext } from "@/src/entities/models/application-context";
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
  const dbService = cxt.getDbService();
  return {
    async getAllAtTenant(): Promise<RoutingRule[]> {
      const results = await dbService.findMany(routingRules);
      return results.map((rule) => ({
        ...rule,
        enabledTools: (rule.enabledTools || []) as RoutingToolName[],
        minutesSavedEstimate: rule.minutesSavedEstimate ?? null,
      }));
    },

    async get(id: string): Promise<RoutingRule | null> {
      const result = await dbService.findFirst(routingRules, {
        where: eq(routingRules.id, id),
      });
      if (!result) return null;
      return {
        ...result,
        enabledTools: (result.enabledTools || []) as RoutingToolName[],
        minutesSavedEstimate: result.minutesSavedEstimate ?? null,
      };
    },

    async create(record: NewRoutingRule) {
      await dbService.insert(
        routingRules,
        dbService.initMetadataAndTenant(record)
      );
    },

    async update(record) {
      dbService.updateMetadata(record);
      await dbService.update(
        routingRules,
        record,
        eq(routingRules.id, record.id)
      );
    },

    async remove(id) {
      await dbService.delete(routingRules, eq(routingRules.id, id));
    },
  };
};
