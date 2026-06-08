import type { ApplicationContext } from "@/src/entities/models/application-context";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import { LLM_DECISION, LLM_TOOL_EXECUTION_STATUS } from "@/src/entities/models/llm-rule-decision";
import { clientRoutingToolRegistry } from "@/src/entities/models/routing-tool-client";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export async function writeDecisionAudits(
  results: RuleEvaluationResult[],
  rules: RoutingRule[],
  {
    tenantId,
    siteId,
    referralId,
    actionResults,
    cxt,
  }: {
    tenantId: string;
    siteId: string;
    referralId: string;
    actionResults: Map<string, string>;
    cxt: ApplicationContext;
  }
): Promise<void> {
  const decisionRepo = cxt.getLlmRuleDecisionAuditRepository();
  const toolRepo = cxt.getLlmRuleToolExecutionAuditRepository();

  for (const result of results) {
    const rule = rules.find((r) => r.id === result.ruleId);
    const ruleVersion = rule?.updatedAt?.toISOString() ?? "1";

    const triggered =
      !result.stoppedByRuleId &&
      !result.evaluation.error &&
      result.evaluation.triggered === true &&
      result.evaluation.actions.length > 0;

    const decision = result.evaluation.error
      ? LLM_DECISION.ERROR
      : triggered
      ? LLM_DECISION.EXECUTE
      : LLM_DECISION.SKIP;

    const decisionAuditId = await decisionRepo.create({
      tenantId,
      siteId,
      referralId,
      ruleId: result.ruleId,
      ruleName: result.ruleName,
      ruleVersion,
      triggered,
      decision,
      reasonSummary: result.evaluation.comment ?? null,
      reasoning: result.evaluation.reasoning ?? null,
      validationError: result.evaluation.error ?? null,
    });

    if (triggered && result.evaluation.actions.length > 0) {
      await toolRepo.createMany(
        result.evaluation.actions.map((action, index) => {
          const toolDef = clientRoutingToolRegistry[action.tool as RoutingToolName];
          return {
            tenantId,
            decisionAuditId,
            siteId,
            referralId,
            ruleId: result.ruleId,
            toolIndex: index,
            toolName: action.tool,
            argsHash: null,
            toolInput: action.input as Record<string, unknown>,
            toolResult: actionResults.get(action.id) ?? null,
            actionType: toolDef?.actionType ?? null,
            status: LLM_TOOL_EXECUTION_STATUS.SUCCESS,
            errorCode: null,
            errorSummary: null,
            startedAt: null,
            finishedAt: null,
          };
        })
      );
    }
  }
}
