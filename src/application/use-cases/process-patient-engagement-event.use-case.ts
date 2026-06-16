import { ApplicationContext } from "@/src/entities/models/application-context";
import {
  getPatientEngagementEventContextDescription,
  type PatientEngagementEventContext,
} from "@/src/entities/models/patient-engagement-event-context";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import { filterBlockedEmailActions } from "./filter-blocked-email-actions";
import { evaluateRulesInOrder } from "./evaluate-rules-in-order";
import { writeDecisionAudits } from "./write-decision-audits";
import { processIntakeQuestionnaireCompletedUseCase } from "./process-intake-questionnaire-completed.use-case";

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
  const evaluateRuleService = createEvaluateRuleService({ cxt });
  const requestDescription = "peEvent_" + event.message.patient.ref;

  const ptUpdate = event.message.note.ptUpdate;
  cxt.logger.info("PE event context for rule evaluation", {
    triggeringEvent: event.triggeringEvent,
    patientRef: event.message.patient.ref,
    oceanSessionId: event.message.oceanSessionId,
    hasForms: !!ptUpdate.completedForms,
    hasProgressNote: !!ptUpdate.progressNote,
    contextFieldsAcrossRules: rules
      .filter((r) => r.active && r.triggeringEvent === event.triggeringEvent)
      .map((r) => ({ ruleName: r.name, allowedContextFields: r.allowedContextFields ?? [] })),
  });

  const evaluationResults: RuleEvaluationResult[] = await evaluateRulesInOrder({
    rules,
    evaluateRule: evaluateRuleService.evaluateRule,
    routingEventMessage: event.message,
    eventType: event.triggeringEvent,
    requestDescription,
  });

  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  const filteredResults = filterBlockedEmailActions(
    evaluationResults,
    siteConfig?.emailSendAllowlist
  );

  const actionResults = new Map<string, string>();
  for (const result of filteredResults) {
    if (result.stoppedByRuleId) continue;
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
      ...(r.stoppedByRuleId ? { skipped: true, skippedByRule: r.stoppedByRuleName } : {}),
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
    .filter((r) => !r.stoppedByRuleId)
    .map((r) => r.evaluation.error)
    .filter(Boolean)
    .join("\n");

  if (siteConfig?.id && cxt.getTenantId()) {
    await writeDecisionAudits(filteredResults, rules, {
      tenantId: cxt.getTenantId()!,
      siteId: siteConfig.id,
      referralId: event.message.patient.ref ?? "unknown",
      actionResults,
      cxt,
    });
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...event,
    details,
    error,
  });

  // After a completed intake questionnaire, attempt to link it to an archived
  // inbound referral and run the dedicated intake routing event. Failures here
  // must not affect the primary patient-engagement response.
  if (event.triggeringEvent === "patient_message_forms_completion") {
    try {
      await processIntakeQuestionnaireCompletedUseCase(event, cxt);
    } catch (e) {
      cxt.logger.error(
        `Error processing intake questionnaire completion for patient ${event.message.patient.ref}: ${e}`
      );
    }
  }

  return {
    message: `Patient engagement event processed for ${getPatientEngagementEventContextDescription(
      event
    )}: ${details} ${error ? `\nError: ${error}` : ""}`,
  };
}
