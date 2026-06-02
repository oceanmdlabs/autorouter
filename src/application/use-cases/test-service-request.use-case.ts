import { NotFoundError } from "@/src/entities/errors/common";
import { ApplicationContext } from "@/src/entities/models/application-context";
import { type RoutingEventType } from "@/src/entities/models/routing-event-type";
import { startSpan } from "@sentry/node";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import { filterBlockedEmailActions } from "./filter-blocked-email-actions";

export const testServiceRequestUseCase =
  (cxt: ApplicationContext) =>
  ({
    testServiceRequestId,
    eventType,
  }: {
    testServiceRequestId: string;
    eventType: RoutingEventType;
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
      const evaluationResults: RuleEvaluationResult[] = [];
      for (const rule of rules) {
        evaluationResults.push(
          await evaluateRuleService.evaluateRule({
            rule,
            routingEventMessage: testServiceRequest.content,
            eventType,
            requestDescription: "testServiceRequest",
          })
        );
      }
      const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
      return filterBlockedEmailActions(evaluationResults, siteConfig?.emailSendAllowlist);
    });
  };
