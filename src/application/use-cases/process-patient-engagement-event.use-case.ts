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
import { createContentFreeRuleSummary } from "./create-content-free-rule-summary";

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

  for (const result of filteredResults) {
    if (result.stoppedByRuleId) continue;
    cxt.logger.info("Processing patient engagement routing actions", {
      eventType: event.triggeringEvent,
      ruleId: result.ruleId,
      tools: result.evaluation.actions.map((action) => action.tool),
    });
    try {
      await cxt
        .getRoutingToolActionService()
        .executeActions(result.evaluation.actions, event, result.ruleName);
    } catch (actionError) {
      cxt.logger.error("Patient engagement routing action failed", {
        eventType: event.triggeringEvent,
        ruleId: result.ruleId,
        errorType:
          actionError instanceof Error ? actionError.name : "UnknownError",
      });
      error = "ROUTING_ACTION_EXECUTION_FAILED";
    }
  }

  if (filteredResults.length === 0) {
    details = details || "No actions taken.";
  } else {
    const rulesSummary = createContentFreeRuleSummary(filteredResults);
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
    } catch (intakeError) {
      cxt.logger.error("Intake questionnaire processing failed", {
        eventType: event.triggeringEvent,
        errorType:
          intakeError instanceof Error ? intakeError.name : "UnknownError",
      });
    }
  }

  return {
    message: `Patient engagement event processed for ${getPatientEngagementEventContextDescription(
      event
    )}: ${details} ${error ? `\nError: ${error}` : ""}`,
  };
}
