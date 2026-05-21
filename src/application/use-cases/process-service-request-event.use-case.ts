import { ApplicationContext } from "@/src/entities/models/application-context";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";
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
    const evaluationResults: RuleEvaluationResult[] = [];
    const evaluateRuleService = createEvaluateRuleService({ cxt });
    if (
      evaluateRuleService.avoidProcessingDueToPatientOptOut(
        event.serviceRequestBundle
      )
    ) {
      details = "Patient has opted out of AI processing.";
    } else {
      for (const rule of rules) {
        evaluationResults.push(
          await evaluateRuleService.evaluateRule({
            rule,
            routingEventMessage: event.serviceRequestBundle,
            eventType: event.triggeringEvent,
            requestDescription: event.referralRef || "pendingServiceRequest",
          })
        );
      }
    }

    for (const result of evaluationResults) {
      cxt.logger.info(
        `Processing rule ${result.ruleName} evaluation actions for ${
          event.referralRef
        }: ${result.evaluation.actions.map((a) => a.tool).join(", ")}`
      );
      try {
        await cxt
          .getRoutingToolActionService()
          .executeActions(result.evaluation.actions, event, result.ruleName);
      } catch (e) {
        cxt.logger.error(
          `Error executing actions for ${event.referralRef}: ${e}`
        );
        error = e instanceof Error ? e.message : "Unknown error";
      }
    }

    if (evaluationResults.length === 0) {
      details = details || "No actions taken.";
    } else {
      const rulesSummary = evaluationResults.map((r) => ({
        ruleName: r.ruleName,
        triggered: r.evaluation.triggered ?? false,
        ...(r.evaluation.comment ? { comment: r.evaluation.comment } : {}),
        ...(r.evaluation.reasoning ? { reasoning: r.evaluation.reasoning } : {}),
        ...(r.evaluation.triggered && r.evaluation.actions.length > 0
          ? { actions: r.evaluation.actions.map((a) => ({ tool: a.tool, input: a.input })) }
          : {}),
      }));
      details = JSON.stringify({ rules: rulesSummary });
    }
    error = evaluationResults
      .map((r) => r.evaluation.error)
      .filter(Boolean)
      .join("\n");
  }

  if (event.archivalMessage) {
    try {
      const parsed = JSON.parse(details ?? "");
      parsed.archival = event.archivalMessage;
      details = JSON.stringify(parsed);
    } catch {
      details = [details, `Archival: ${event.archivalMessage}`]
        .filter(Boolean)
        .join("\n");
    }
  }
  if (event.archivalError) {
    error = [error, `Archival: ${event.archivalError}`]
      .filter(Boolean)
      .join("\n");
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...event,
    details,
    error,
  });

  return {
    message: `Service request event processed for ${
      event.referralRef
    }: ${details} ${error ? `\nError: ${error}` : ""}`,
  };
}
