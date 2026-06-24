import { ApplicationContext } from "@/src/entities/models/application-context";
import { asc, desc, eq, sql } from "drizzle-orm";
import { routingRules } from "@/drizzle/schema";
import type {
  AllowedContextField,
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
      const results = await dbService.findMany(routingRules, {
        orderBy: [asc(routingRules.priority), asc(routingRules.createdAt), asc(routingRules.id)],
      });
      return results.map((rule) => ({
        ...rule,
        enabledTools: (rule.enabledTools || []) as RoutingToolName[],
        allowedContextFields: (rule.allowedContextFields || []) as AllowedContextField[],
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
        allowedContextFields: (result.allowedContextFields || []) as AllowedContextField[],
      };
    },

    async create(record: NewRoutingRule) {
      const [latest] = await dbService.findMany(routingRules, {
        orderBy: desc(routingRules.priority),
        limit: 1,
      });
      const nextPriority = (latest?.priority ?? 0) + 1;
      const prepared = dbService.initMetadataAndTenant(record);
      await dbService.insert(routingRules, {
        ...prepared,
        priority: record.priority ?? nextPriority,
        triggeringEvent: sql`${prepared.triggeringEvent}::triggering_event`,
      });
    },

    async update(record) {
      dbService.updateMetadata(record);
      await dbService.update(routingRules, {
        ...record,
        triggeringEvent: sql`${record.triggeringEvent}::triggering_event`,
      }, eq(routingRules.id, record.id));
    },

    async remove(id) {
      await dbService.delete(routingRules, eq(routingRules.id, id));
    },

    async reorder(orderedIds: string[]) {
      for (let i = 0; i < orderedIds.length; i++) {
        await dbService.update(
          routingRules,
          { priority: i + 1 },
          eq(routingRules.id, orderedIds[i]!)
        );
      }
    },
  };
};
