import type { ApplicationContext } from "@/src/entities/models/application-context";
import type {
  CDSCard,
  CDSHookRequest,
  CDSHookResponse,
  CDSSource,
} from "@/src/entities/models/cds-hooks";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import { uuid } from "@/src/entities/models/uuid";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import {
  routingToolRegistry,
  type RoutingToolName,
} from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
export const ORDER_SIGN_CDS_ID = "order-sign-cds";

interface Deps {
  cxt: ApplicationContext;
}

export async function orderSignCds({
  deps: { cxt },
  input: { request },
}: {
  deps: Deps;
  input: { request: CDSHookRequest };
}): Promise<CDSHookResponse> {
  // https://cds-hooks.org/hooks/order-sign/

  cxt.logger.info(`cds-services-handler`);
  // this id is shared across both order hooks: https://cds-hooks.hl7.org/2.0/#update-stale-guidance
  // "Note that a CDS server can host multiple entries of CDS service with the same id for different hooks. This allows a service to update its advice based on changes in workflow"
  const routingService = cxt.getRoutingRulesRepository();
  const routingRules = await routingService.getAllAtTenant();
  const eventType = "request_pre_submission";
  const orderSignRules = routingRules.filter(
    (r) => r.triggeringEvent === eventType
  );
  const cards: CDSCard[] = [];

  for (const rule of orderSignRules) {
    const ruleEvaluationResult = await createEvaluateRuleService({
      cxt,
    }).evaluateRule({ rule, serviceRequestMessage: request, eventType });
    for (const action of ruleEvaluationResult.evaluation.actions) {
      const tool = routingToolRegistry[action.tool as RoutingToolName];
      if (tool === routingToolRegistry.showCdsCard) {
        const checkSubmissionAction =
          action as RoutingToolAction<"showCdsCard">;

        const params = checkSubmissionAction.input;
        cards.push({
          uuid: uuid(),
          indicator:
            params.severity === "blocker"
              ? "critical"
              : params.severity === "warning"
              ? "warning"
              : "info",
          summary: params.title,
          detail: params.message ?? "",
          suggestions: [
            {
              uuid: uuid(),
              label: params.message ?? "",
              actions: [],
            },
          ],
          source: createSource(rule),
        });
      }
    }
  }
  return {
    cards,
  } satisfies CDSHookResponse;

  function createSource(rule: RoutingRule): CDSSource {
    return {
      label: `Rule '${rule.name}' from ${cxt.appName()}`,
      url: cxt.appUrl(),
    };
  }
}
