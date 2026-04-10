import { ApplicationContext } from "@/src/entities/models/application-context";
import { getRoutingToolActionDescription } from "@/src/entities/models/routing-tool";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import { createJsonDecisionEvaluatorService } from "@/src/infrastructure/services/json-decision-evaluator.service";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import {
  getLlmRuleJsonDecisionAuditMode,
  LLM_RULE_JSON_DECISION_AUDIT_MODE,
  LLM_DECISION
} from "@/src/entities/models/llm-rule-decision";

export interface ProcessServiceRequestEventOutput {
  message: string;
}

export async function processServiceRequestEventUseCase(
  event: ServiceRequestEventContext,
  cxt: ApplicationContext
): Promise<ProcessServiceRequestEventOutput> {

  cxt.logger.info(
    `Processing service request event ${event.triggeringEvent} for service request ${event.referralRef}`
  );
  let details = event.details;
  let error = null;

  if (event.triggeringEvent) {
    const rules = await cxt.getRoutingRulesRepository().getAllAtTenant();

    if (rules.length === 0) {
      const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
      details = siteConfig
        ? `Site Configuration "${siteConfig.name}" has a service request connection but no rules defined.`
        : `No site configuration found for tenant.`;

      cxt.logger.info(details);
      return { message: details };
    }

    if (!hasActiveRulesForEvent(event.triggeringEvent, rules)) {
      const message = `No active rules for event ${event.triggeringEvent}.`;
      cxt.logger.info(message);
      return { message };
    }

    const evaluationResults: RuleEvaluationResult[] = [];
    const evaluateRuleService = createEvaluateRuleService({ cxt });
    const jsonDecisionEvaluator = createJsonDecisionEvaluatorService({ cxt });
    const auditMode = getLlmRuleJsonDecisionAuditMode();

    cxt.logger.debug(`LLM Rule JSON Decision Audit Mode: ${auditMode}`);

    if (
      evaluateRuleService.avoidProcessingDueToPatientOptOut(
        event.serviceRequestBundle
      )
    ) {
      details = "Patient has opted out of AI processing.";
    } else {
      // Get site config for siteId
      const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
      const siteId = siteConfig?.id || cxt.getTenantId() || "unknown";

      for (const rule of rules) {
        if (auditMode === LLM_RULE_JSON_DECISION_AUDIT_MODE.ON && rule.active && rule.triggeringEvent === event.triggeringEvent) {
          // ON mode: Use JSON decision for execution
          const jsonResult = await jsonDecisionEvaluator.evaluateRuleWithJsonDecision({
            rule,
            routingEventMessage: event.serviceRequestBundle,
            eventType: event.triggeringEvent,
            referralId: event.referralRef || "pendingServiceRequest",
            siteId
          });

          if (jsonResult.decision === LLM_DECISION.EXECUTE && jsonResult.parsedOutput) {
            // Convert only VALID JSON tools to routing actions (those that passed validation)
            const validActions = jsonResult.validToolIndices.map((toolIndex) => {
              const tool = jsonResult.parsedOutput!.tools[toolIndex];
              const toolAuditId = jsonResult.toolExecutionAuditIds[toolIndex];
              return {
                action: {
                  id: toolAuditId || `${jsonResult.decisionAuditId}-${toolIndex}`,
                  tool: tool!.toolName as any,
                  input: tool!.args as any
                },
                toolAuditId
              };
            });

            // For display purposes, include all tools in the evaluation result
            const allActions = jsonResult.parsedOutput.tools.map((tool, index) => ({
              id: jsonResult.toolExecutionAuditIds[index] || `${jsonResult.decisionAuditId}-${index}`,
              tool: tool.toolName as any,
              input: tool.args as any
            }));

            evaluationResults.push({
              ruleId: rule.id,
              ruleName: rule.name,
              evaluation: {
                actions: allActions,
                triggered: true,
                comment: jsonResult.parsedOutput.reasonSummary +
                  (validActions.length < jsonResult.parsedOutput.tools.length
                    ? ` (${jsonResult.parsedOutput.tools.length - validActions.length} tool(s) skipped due to validation errors)`
                    : "")
              }
            });

            // Execute only valid actions and update audit records
            for (const { action, toolAuditId } of validActions) {
              const startedAt = new Date();
              try {
                await cxt.getRoutingToolActionService().executeActions([action], event);
                if (toolAuditId) {
                  await jsonDecisionEvaluator.updateToolExecutionStatus(toolAuditId, true, undefined, startedAt);
                }
              } catch (e) {
                const errorMsg = e instanceof Error ? e.message : "Unknown error";
                if (toolAuditId) {
                  await jsonDecisionEvaluator.updateToolExecutionStatus(toolAuditId, false, {
                    code: "EXECUTION_ERROR",
                    summary: errorMsg.substring(0, 200)
                  }, startedAt);
                }
                cxt.logger.error(`Error executing tool ${action.tool}: ${errorMsg}`);
              }
            }
          } else {
            evaluationResults.push({
              ruleId: rule.id,
              ruleName: rule.name,
              evaluation: {
                actions: [],
                triggered: jsonResult.decision !== LLM_DECISION.SKIP,
                comment: jsonResult.validationError || "Decision: SKIP"
              }
            });
          }
        } else {
          // OFF or SHADOW mode: Use existing tool-call behavior
          const result = await evaluateRuleService.evaluateRule({
            rule,
            routingEventMessage: event.serviceRequestBundle,
            eventType: event.triggeringEvent,
            requestDescription: event.referralRef || "pendingServiceRequest"
          });
          evaluationResults.push(result);

          // SHADOW mode: Also run JSON decision in parallel for auditing (only for active rules)
          if (auditMode === LLM_RULE_JSON_DECISION_AUDIT_MODE.SHADOW && rule.active && rule.triggeringEvent === event.triggeringEvent) {
            try {
              const jsonResult = await jsonDecisionEvaluator.evaluateRuleWithJsonDecision({
                rule,
                routingEventMessage: event.serviceRequestBundle,
                eventType: event.triggeringEvent,
                referralId: event.referralRef || "pendingServiceRequest",
                siteId
              });
              cxt.logger.info(`SHADOW mode: JSON decision audit recorded`, {
                decisionAuditId: jsonResult.decisionAuditId,
                decision: jsonResult.decision,
                ruleId: rule.id
              });
            } catch (shadowError) {
              cxt.logger.warn(`SHADOW mode: Failed to evaluate JSON decision`, {
                error: shadowError,
                ruleId: rule.id
              });
            }
          }
        }
      }
    }

    // Execute actions for OFF/SHADOW modes (ON mode already executed above)
    if (auditMode !== LLM_RULE_JSON_DECISION_AUDIT_MODE.ON) {
      for (const result of evaluationResults) {
        cxt.logger.info(
          `Processing rule ${result.ruleName} evaluation actions for ${
            event.referralRef
          }: ${result.evaluation.actions.map((a) => a.tool).join(", ")}`
        );
        try {
          await cxt
            .getRoutingToolActionService()
            .executeActions(result.evaluation.actions, event);
        } catch (e) {
          cxt.logger.error(
            `Error executing actions for ${event.referralRef}: ${e}`
          );
          error = e instanceof Error ? e.message : "Unknown error";
        }
      }
    }

    details = evaluationResults
      .filter((r) => r.evaluation.triggered)
      .map(
        (r) =>
          `${r.ruleName}: ${
            r.evaluation.comment ? r.evaluation.comment + ": " : ""
          } ` +
          r.evaluation.actions
            .map((action) => getRoutingToolActionDescription(action))
            .join("\n")
      )
      .filter(Boolean)
      .join("\n");
    if (!details) {
      details = "No actions taken.";
    } else {
      details = `${details}`;
    }
    error = evaluationResults
      .map((r) => r.evaluation.error)
      .filter(Boolean)
      .join("\n");
  }

  return {
    message: `Service request event processed for ${
      event.referralRef
    }: ${details} ${error ? `\nError: ${error}` : ""}`
  };
}

// check if there is a rule for the triggering event and it is active
function hasActiveRulesForEvent(triggeringEvent: RoutingEventType, rules: RoutingRule[]): boolean {
  return rules.some(rule =>
    rule.active &&
    rule.triggeringEvent === triggeringEvent
  );
}
