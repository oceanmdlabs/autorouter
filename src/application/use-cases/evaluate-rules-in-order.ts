import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { RuleEvaluationResult, RoutingEventMessage } from "@/src/entities/models/routing-evaluation";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";

export async function evaluateRulesInOrder({
  rules,
  evaluateRule,
  routingEventMessage,
  eventType,
  requestDescription,
}: {
  rules: RoutingRule[];
  evaluateRule: (params: {
    rule: RoutingRule;
    routingEventMessage: RoutingEventMessage;
    eventType: RoutingEventType;
    requestDescription: string;
  }) => Promise<RuleEvaluationResult>;
  routingEventMessage: RoutingEventMessage;
  eventType: RoutingEventType;
  requestDescription: string;
}): Promise<RuleEvaluationResult[]> {
  const results: RuleEvaluationResult[] = [];
  let stoppedBy: { id: string; name: string } | null = null;

  for (const rule of rules) {
    if (stoppedBy) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        evaluation: {
          actions: [],
          comment: `Not evaluated — "${stoppedBy.name}" stopped further rule processing.`,
        },
        stoppedByRuleId: stoppedBy.id,
        stoppedByRuleName: stoppedBy.name,
      });
      continue;
    }

    const result = await evaluateRule({ rule, routingEventMessage, eventType, requestDescription });
    results.push(result);

    if (
      rule.stopProcessingOnMatch &&
      result.evaluation.triggered === true &&
      result.evaluation.actions.length > 0 &&
      !result.evaluation.error
    ) {
      stoppedBy = { id: rule.id, name: rule.name };
    }
  }

  return results;
}
