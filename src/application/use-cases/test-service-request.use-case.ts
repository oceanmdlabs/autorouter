import { NotFoundError } from "@/src/entities/errors/common";
import { ApplicationContext } from "@/src/entities/models/application-context";
import { type RoutingEventType } from "@/src/entities/models/routing-event-type";
import { startSpan } from "@sentry/node";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import { filterBlockedEmailActions } from "./filter-blocked-email-actions";
import { evaluateRulesInOrder } from "./evaluate-rules-in-order";
import { routingToolRegistry } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export const testServiceRequestUseCase =
  (cxt: ApplicationContext) =>
  ({
    testServiceRequestId,
    eventType,
    mode = "evaluate",
  }: {
    testServiceRequestId: string;
    eventType: RoutingEventType;
    mode?: "evaluate" | "dry-run";
  }): Promise<RuleEvaluationResult[]> => {
    return startSpan({ name: "testServiceRequestUseCase" }, async () => {
      const testServiceRequest = await cxt
        .getTestServiceRequestsRepository()
        .get(testServiceRequestId);
      if (!testServiceRequest) {
        throw new NotFoundError("Test service request not found");
      }
      const rules = await cxt.getRoutingRulesRepository().getAllAtTenant();
      const evaluateRuleService = createEvaluateRuleService({ cxt });
      const evaluationResults: RuleEvaluationResult[] = await evaluateRulesInOrder({
        rules,
        evaluateRule: evaluateRuleService.evaluateRule,
        routingEventMessage: testServiceRequest.content,
        eventType,
        requestDescription: "testServiceRequest",
      });
      const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
      const filtered = filterBlockedEmailActions(evaluationResults, siteConfig?.emailSendAllowlist);

      if (mode === "dry-run") {
        const eventContext = {
          serviceRequestBundle: testServiceRequest.content,
          triggeringEvent: eventType,
        };
        for (const result of filtered) {
          if (result.stoppedByRuleId) continue;
          for (const action of result.evaluation.actions) {
            const toolDef = routingToolRegistry[action.tool];
            if (toolDef?.dryRun) {
              try {
                action.dryRunPayload = await (toolDef.dryRun as any)(action, eventContext, cxt);
              } catch (e) {
                action.dryRunPayload = {
                  payloadType: "internal",
                  summary: "Error generating payload",
                  payload: {},
                  error: (e as Error).message,
                };
              }
            }
          }
        }
      }

      return filtered;
    });
  };
