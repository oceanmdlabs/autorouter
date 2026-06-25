import { ApplicationContext } from "@/src/entities/models/application-context";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";
import { filterBlockedEmailActions } from "./filter-blocked-email-actions";
import { evaluateRulesInOrder } from "./evaluate-rules-in-order";
import { writeDecisionAudits } from "./write-decision-audits";
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
          cxt.logger.warn(`Failed to pre-summarize attachments: ${(err as Error).message}`);
        }
      }

      let directoryListingsSummary: string | undefined;
      const needsDirectoryListings = rules.some((r) =>
        r.allowedContextFields?.includes("directoryListings")
      );
      if (needsDirectoryListings) {
        try {
          cxt.logger.info("Pre-fetching healthcare services for rule evaluation context");
          const services = await cxt.getHealthcareServicesRepository().getAllAtTenant();
          if (services.length > 0) {
            directoryListingsSummary = services
              .map((s) => `- ${s.name} (${s.oceanReference}): ${s.description}`)
              .join("\n");
          }
        } catch (err) {
          cxt.logger.warn(`Failed to pre-fetch healthcare services: ${(err as Error).message}`);
        }
      }

      evaluationResults = await evaluateRulesInOrder({
        rules,
        evaluateRule: evaluateRuleService.evaluateRule,
        routingEventMessage: event.serviceRequestBundle,
        eventType: event.triggeringEvent,
        requestDescription: event.referralRef || "pendingServiceRequest",
        attachmentSummary: event.attachmentSummary,
        directoryListingsSummary,
      });
    }

    const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
    const filteredResults = filterBlockedEmailActions(
      evaluationResults,
      siteConfig?.emailSendAllowlist
    );

    const actionResults = new Map<string, string>();
    for (const result of filteredResults) {
      if (result.stoppedByRuleId) continue;
      cxt.logger.info(
        `Processing rule ${result.ruleName} evaluation actions for ${
          event.referralRef
        }: ${result.evaluation.actions.map((a) => a.tool).join(", ")}`
      );
      try {
        const results = await cxt
          .getRoutingToolActionService()
          .executeActions(result.evaluation.actions, event, result.ruleName);
        results.forEach((v, k) => actionResults.set(k, v));
      } catch (e) {
        cxt.logger.error(
          `Error executing actions for ${event.referralRef}: ${e}`
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
        referralId: event.referralRef ?? "unknown",
        actionResults,
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
