import type { ApplicationContext } from "@/src/entities/models/application-context";
import type {
  CDSCard,
  CDSHookRequest,
  CDSHookResponse,
  CDSSource,
} from "@/src/entities/models/cds-hooks";
import type {
  RuleEvaluationResult,
  ServiceRequestEventMessage,
} from "@/src/entities/models/routing-evaluation";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import { uuid } from "@/src/entities/models/uuid";
import { createEvaluateRuleService } from "@/src/infrastructure/services/evaluate-rule.service";
import {
  routingToolRegistry,
  type RoutingToolName,
} from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
import type { Bundle } from "fhir/r4";
import { writeDecisionAudits } from "./write-decision-audits";
export const ORDER_SIGN_CDS_ID = "order-sign-cds";

interface Deps {
  cxt: ApplicationContext;
}

export async function orderSignCds({
  deps: { cxt },
  input: { request },
}: {
  deps: Deps;
  input: { request: CDSHookRequest };
}): Promise<CDSHookResponse> {
  // https://cds-hooks.org/hooks/order-sign/

  cxt.logger.info(`cds-services-handler`);
  // this id is shared across both order hooks: https://cds-hooks.hl7.org/2.0/#update-stale-guidance
  // "Note that a CDS server can host multiple entries of CDS service with the same id for different hooks. This allows a service to update its advice based on changes in workflow"
  const routingService = cxt.getRoutingRulesRepository();
  const routingRules = await routingService.getAllAtTenant();
  const eventType = "request_pre_submission";
  const orderSignRules = routingRules.filter(
    (r) => r.triggeringEvent === eventType
  );
  const cards: CDSCard[] = [];
  const routingEventMessage: ServiceRequestEventMessage = request.prefetch
    ?.v11Bundle as Bundle;
  const evaluationResults: RuleEvaluationResult[] = [];
  const actionResults = new Map<string, string>();

  for (const rule of orderSignRules) {
    const ruleEvaluationResult = await createEvaluateRuleService({
      cxt,
    }).evaluateRule({
      rule,
      routingEventMessage,
      eventType,
      requestDescription: "orderSignCds",
    });
    evaluationResults.push(ruleEvaluationResult);
    for (const action of ruleEvaluationResult.evaluation.actions) {
      const tool = routingToolRegistry[action.tool as RoutingToolName];
      if (tool === routingToolRegistry.showCdsCard) {
        const checkSubmissionAction =
          action as RoutingToolAction<"showCdsCard">;

        const params = checkSubmissionAction.input;
        cards.push({
          uuid: uuid(),
          indicator:
            params.severity === "blocker"
              ? "critical"
              : params.severity === "warning"
              ? "warning"
              : "info",
          summary: params.title,
          detail: params.message ?? "",
          suggestions: [
            {
              uuid: uuid(),
              label: params.message ?? "",
              actions: [],
            },
          ],
          source: createSource(rule),
        });
        actionResults.set(action.id, `CDS card shown: ${params.title}`);
      }
    }
  }

  await writeActivityLog();

  return {
    cards,
  } satisfies CDSHookResponse;

  function createSource(rule: RoutingRule): CDSSource {
    return {
      label: `Rule '${rule.name}' from ${cxt.appName()}`,
      url: cxt.appUrl(),
    };
  }

  // Record the CDS hook evaluation in the activity log so pre-submission
  // (order-sign) rule runs are visible alongside the other event types.
  async function writeActivityLog(): Promise<void> {
    const rulesSummary = evaluationResults.map((r) => ({
      ruleName: r.ruleName,
      triggered: r.evaluation.triggered ?? false,
      ...(r.evaluation.comment ? { comment: r.evaluation.comment } : {}),
      ...(r.evaluation.reasoning ? { reasoning: r.evaluation.reasoning } : {}),
      ...(r.evaluation.triggered && r.evaluation.actions.length > 0
        ? {
            actions: r.evaluation.actions.map((a) => ({
              tool: a.tool,
              input: a.input,
              ...(actionResults.has(a.id)
                ? { result: actionResults.get(a.id) }
                : {}),
            })),
          }
        : {}),
    }));

    const details =
      evaluationResults.length === 0
        ? "CDS hook (order-sign) received; no pre-submission rules to evaluate."
        : JSON.stringify({ rules: rulesSummary });

    const error =
      evaluationResults
        .map((r) => r.evaluation.error)
        .filter(Boolean)
        .join("\n") || null;

    try {
      await cxt.getActivityLogEntriesRepository().create({
        triggeringEvent: eventType,
        details,
        error,
      });
    } catch (err) {
      cxt.logger.warn(
        `Failed to write CDS hook activity log entry: ${(err as Error).message}`
      );
    }

    // Persist per-rule LLM decision + tool-execution audits so the CDS
    // (order-sign) path appears in the audit explorer like other event types.
    const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
    const tenantId = cxt.getTenantId();
    if (siteConfig?.id && tenantId) {
      try {
        await writeDecisionAudits(evaluationResults, orderSignRules, {
          tenantId,
          siteId: siteConfig.id,
          referralId: "pre-submission",
          actionResults,
          cxt,
        });
      } catch (err) {
        cxt.logger.warn(
          `Failed to write CDS hook decision audits: ${(err as Error).message}`
        );
      }
    }
  }
}
