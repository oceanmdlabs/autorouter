import { ApplicationContext } from "@/src/entities/models/application-context";
import {
  getPatientEngagementEventContextDescription,
  type PatientEngagementEventContext,
} from "@/src/entities/models/patient-engagement-event-context";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import { filterBlockedEmailActions } from "./filter-blocked-email-actions";

export interface ProcessPEEventOutput {
  message: string;
}

export async function processPatientEngagementEventUseCase(
  event: PatientEngagementEventContext,
  cxt: ApplicationContext
): Promise<ProcessPEEventOutput> {
  cxt.logger.info(`Processing PE event ${event.triggeringEvent}`);
  let details = "";
  let error = null;

  const rules = await cxt.getRoutingRulesRepository().getAllAtTenant();
  const evaluationResults: RuleEvaluationResult[] = [];
  const evaluateRuleService = createEvaluateRuleService({ cxt });
  const requestDescription = "peEvent_" + event.message.patient.ref;
  for (const rule of rules) {
    evaluationResults.push(
      await evaluateRuleService.evaluateRule({
        rule,
        routingEventMessage: event.message,
        eventType: event.triggeringEvent,
        requestDescription,
      })
    );
  }
  event.message.note.ptUpdate.completedForms;

  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  const filteredResults = filterBlockedEmailActions(
    evaluationResults,
    siteConfig?.emailSendAllowlist
  );

  const actionResults = new Map<string, string>();
  for (const result of filteredResults) {
    cxt.logger.info(
      `Processing rule ${
        result.ruleName
      } evaluation actions for patient engagement event ${getPatientEngagementEventContextDescription(
        event
      )}
      }: ${result.evaluation.actions.map((a) => a.tool).join(", ")}`
    );
    try {
      const results = await cxt
        .getRoutingToolActionService()
        .executeActions(result.evaluation.actions, event, result.ruleName);
      results.forEach((v, k) => actionResults.set(k, v));
    } catch (e) {
      cxt.logger.error(
        `Error executing actions for patient engagement event ${getPatientEngagementEventContextDescription(
          event
        )}: ${e}`
      );
      error = e instanceof Error ? e.message : "Unknown error";
    }
  }

  if (filteredResults.length === 0) {
    details = details || "No actions taken.";
  } else {
    const rulesSummary = filteredResults.map((r) => ({
      ruleName: r.ruleName,
      triggered: r.evaluation.triggered ?? false,
      ...(r.evaluation.comment ? { comment: r.evaluation.comment } : {}),
      ...(r.evaluation.reasoning ? { reasoning: r.evaluation.reasoning } : {}),
      ...(r.evaluation.triggered && r.evaluation.actions.length > 0
        ? {
            actions: r.evaluation.actions.map((a) => ({
              tool: a.tool,
              input: a.input,
              ...(actionResults.has(a.id) ? { result: actionResults.get(a.id) } : {}),
            })),
          }
        : {}),
    }));
    details = JSON.stringify({ rules: rulesSummary });
  }
  error = filteredResults
    .map((r) => r.evaluation.error)
    .filter(Boolean)
    .join("\n");

  await cxt.getActivityLogEntriesRepository().create({
    ...event,
    details,
    error,
  });

  return {
    message: `Patient engagement event processed for ${getPatientEngagementEventContextDescription(
      event
    )}: ${details} ${error ? `\nError: ${error}` : ""}`,
  };
}
