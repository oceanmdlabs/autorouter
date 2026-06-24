import type { Bundle } from "fhir/r4";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type {
  MatchedErequest,
  PatientEngagementEventContext,
} from "@/src/entities/models/patient-engagement-event-context";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import { matchArchivedErequestForPatient } from "./match-archived-erequest";
import { evaluateRulesInOrder } from "./evaluate-rules-in-order";
import { filterBlockedEmailActions } from "./filter-blocked-email-actions";
import { writeDecisionAudits } from "./write-decision-audits";

const INTAKE_EVENT = "intake_questionnaire_completed" as const;

/**
 * After a Patient Engagement intake questionnaire is completed, attempts to link
 * it to an archived inbound eReferral/eConsult for the same patient and, when a
 * match is found, runs the `intake_questionnaire_completed` routing rules against
 * the combined intake + referral context.
 *
 * Requires eRequest archival to be enabled. The matching outcome (no referral /
 * one referral / multiple with the most recent selected) is always recorded in an
 * Activity Log entry for transparency.
 */
export async function processIntakeQuestionnaireCompletedUseCase(
  formsCompletionEvent: PatientEngagementEventContext,
  cxt: ApplicationContext
): Promise<void> {
  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  if (!siteConfig?.erequestArchivalEnabled) {
    // Archival disabled — the intake-to-referral event does not run.
    return;
  }

  const patient = formsCompletionEvent.message.patient;
  const matchResult = await matchArchivedErequestForPatient(patient, cxt);

  // Human-readable description of WHICH identifier matched. Note: we log the
  // matching method, not the identifier value itself — the health number is PHI
  // and must not be written to logs or Activity Log entries in plaintext.
  const matchMethod =
    matchResult.status === "none"
      ? undefined
      : matchResult.strategy === "mrn_dob"
      ? "medical record number + date of birth"
      : matchResult.strategy === "hn_dob"
      ? "health number + date of birth"
      : "name + date of birth";

  const matchSummary =
    matchResult.status === "none"
      ? "No archived inbound referral matched this patient; no intake referral actions were taken."
      : matchResult.status === "single"
      ? `Matched one archived inbound referral (${
          matchResult.match.referralRef ?? matchResult.match.id
        }) by ${matchMethod}.`
      : `Matched ${matchResult.candidateCount} archived inbound referrals by ${matchMethod}; selected the most recently received (${
          matchResult.match.referralRef ?? matchResult.match.id
        }) using the recency heuristic.`;

  cxt.logger.info(`Intake questionnaire referral matching: ${matchSummary}`, {
    patientRef: patient.ref,
    status: matchResult.status,
    matchMethod,
  });

  if (matchResult.status === "none") {
    await cxt.getActivityLogEntriesRepository().create({
      triggeringEvent: INTAKE_EVENT,
      referralRef: null,
      details: matchSummary,
      error: null,
    });
    return;
  }

  const matched = matchResult.match;
  const matchedBundle = (matched.rawBundle as Bundle | null) ?? undefined;
  const matchedErequest: MatchedErequest = {
    erequestId: matched.id,
    referralRef: matched.referralRef,
    receivedAt: matched.receivedAt,
    requestedListingTitle: matched.requestedListingTitle,
    serviceRequestBundle: matchedBundle,
  };

  const intakeEvent: PatientEngagementEventContext = {
    triggeringEvent: INTAKE_EVENT,
    message: {
      ...formsCompletionEvent.message,
      matchedErequest,
    },
    serviceRequestBundle: matchedBundle,
    referralRef: matched.referralRef ?? undefined,
  };

  const rules = await cxt.getRoutingRulesRepository().getAllAtTenant();
  const evaluateRuleService = createEvaluateRuleService({ cxt });

  const evaluationResults: RuleEvaluationResult[] = await evaluateRulesInOrder({
    rules,
    evaluateRule: evaluateRuleService.evaluateRule,
    routingEventMessage: intakeEvent.message,
    eventType: INTAKE_EVENT,
    requestDescription: "intake_" + patient.ref,
  });

  const filteredResults = filterBlockedEmailActions(
    evaluationResults,
    siteConfig.emailSendAllowlist
  );

  const actionResults = new Map<string, string>();
  let error: string | null = null;
  for (const result of filteredResults) {
    if (result.stoppedByRuleId) continue;
    if (!result.evaluation.triggered || result.evaluation.actions.length === 0) {
      continue;
    }
    try {
      const results = await cxt
        .getRoutingToolActionService()
        .executeActions(result.evaluation.actions, intakeEvent, result.ruleName);
      results.forEach((v, k) => actionResults.set(k, v));
    } catch (e) {
      cxt.logger.error(
        `Error executing intake questionnaire actions for patient ${patient.ref}: ${e}`
      );
      error = e instanceof Error ? e.message : "Unknown error";
    }
  }

  const evaluationErrors = filteredResults
    .filter((r) => !r.stoppedByRuleId)
    .map((r) => r.evaluation.error)
    .filter(Boolean)
    .join("\n");

  const rulesSummary = filteredResults
    .filter((r) => !r.stoppedByRuleId)
    .map((r) => ({
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

  if (siteConfig.id && cxt.getTenantId()) {
    await writeDecisionAudits(filteredResults, rules, {
      tenantId: cxt.getTenantId()!,
      siteId: siteConfig.id,
      referralId: matched.referralRef ?? matched.id,
      actionResults,
      cxt,
    });
  }

  await cxt.getActivityLogEntriesRepository().create({
    triggeringEvent: INTAKE_EVENT,
    referralRef: matched.referralRef ?? null,
    details: JSON.stringify({ match: matchSummary, rules: rulesSummary }),
    error: error || evaluationErrors || null,
  });
}
