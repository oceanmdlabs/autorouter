import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";

/**
 * Activity logs are operational audit records, not a store for prompts,
 * completions, referral content, or generated tool arguments/results.
 */
export function createContentFreeRuleSummary(results: RuleEvaluationResult[]) {
  return results.map((result) => ({
    ruleId: result.ruleId,
    ruleName: result.ruleName,
    triggered: result.evaluation.triggered === true,
    ...(result.stoppedByRuleId
      ? {
          skipped: true,
          skippedByRuleId: result.stoppedByRuleId,
          skippedByRuleName: result.stoppedByRuleName,
        }
      : {}),
    ...(result.evaluation.actions.length > 0
      ? {
          actions: result.evaluation.actions.map((action) => ({
            tool: action.tool,
          })),
        }
      : {}),
    ...(result.evaluation.error
      ? { errorCode: "RULE_EVALUATION_FAILED" }
      : {}),
  }));
}
