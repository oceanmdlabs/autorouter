import { ApplicationContext } from "@/src/entities/models/application-context";
import { getRoutingToolActionDescription } from "@/src/entities/models/routing-tool";
import {
  getPatientEngagementEventContextDescription,
  type PatientEngagementEventContext,
} from "@/src/entities/models/patient-engagement-event-context";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";

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

  for (const result of evaluationResults) {
    cxt.logger.info(
      `Processing rule ${
        result.ruleName
      } evaluation actions for patient engagement event ${getPatientEngagementEventContextDescription(
        event
      )}
      }: ${result.evaluation.actions.map((a) => a.tool).join(", ")}`
    );
    try {
      await cxt
        .getRoutingToolActionService()
        .executeActions(result.evaluation.actions, event);
    } catch (e) {
      cxt.logger.error(
        `Error executing actions for patient engagement event ${getPatientEngagementEventContextDescription(
          event
        )}: ${e}`
      );
      error = e instanceof Error ? e.message : "Unknown error";
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
