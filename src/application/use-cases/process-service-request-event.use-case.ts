import { ApplicationContext } from "@/src/entities/models/application-context";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";
import { filterBlockedEmailActions } from "./filter-blocked-email-actions";
import { evaluateRulesInOrder } from "./evaluate-rules-in-order";
import { writeDecisionAudits } from "./write-decision-audits";
import { createContentFreeRuleSummary } from "./create-content-free-rule-summary";
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
    const evaluateRuleService = createEvaluateRuleService({ cxt });
    let evaluationResults: RuleEvaluationResult[] = [];
    if (
      evaluateRuleService.avoidProcessingDueToPatientOptOut(
        event.serviceRequestBundle
      )
    ) {
      details = "Patient has opted out of AI processing.";
    } else {
      const needsAttachmentSummary =
        rules.some((r) => r.allowedContextFields?.includes("attachments")) &&
        (event.attachments?.length ?? 0) > 0;
      if (needsAttachmentSummary) {
        try {
          cxt.logger.info("Pre-summarizing attachments for rule evaluation context");
          event.attachmentSummary = await cxt.getAiService().summarizeAttachments(
            "Summarize the full contents of these attachments to assist in routing rule evaluation.",
            event.attachments!
          );
        } catch (err) {
          cxt.logger.warn("Attachment summarization failed", {
            errorType: err instanceof Error ? err.name : "UnknownError",
          });
        }
      }

      evaluationResults = await evaluateRulesInOrder({
        rules,
        evaluateRule: evaluateRuleService.evaluateRule,
        routingEventMessage: event.serviceRequestBundle,
        eventType: event.triggeringEvent,
        requestDescription: event.referralRef || "pendingServiceRequest",
        attachmentSummary: event.attachmentSummary,
      });
    }

    const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
    const filteredResults = filterBlockedEmailActions(
      evaluationResults,
      siteConfig?.emailSendAllowlist
    );

    for (const result of filteredResults) {
      if (result.stoppedByRuleId) continue;
      cxt.logger.info(
        `Processing rule ${result.ruleName} evaluation actions for ${
          event.referralRef
        }: ${result.evaluation.actions.map((a) => a.tool).join(", ")}`
      );
      try {
        await cxt
          .getRoutingToolActionService()
          .executeActions(result.evaluation.actions, event, result.ruleName);
      } catch (actionError) {
        cxt.logger.error("Routing action execution failed", {
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
        referralId: event.referralRef ?? "unknown",
        cxt,
      });
    }
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
