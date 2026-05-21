import type {
  ToolCall,
  ToolSet,
} from "@/src/application/services/ai.service.interface";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { isPatientEngagementEventMessage } from "@/src/entities/models/patient-engagement-event-context";
import type {
  RoutingEventMessage,
  RuleEvaluationResult,
  ServiceRequestEventMessage,
} from "@/src/entities/models/routing-evaluation";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type {
  RoutingToolAction,
  RoutingToolDefinition,
} from "@/src/entities/models/routing-tool";
import { uuid } from "@/src/entities/models/uuid";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
import type { ZodTypeAny } from "zod";
import { createEvaluatePEEventRulePrompt } from "./prompts/evaluate-pe-rule-prompt";
import { evaluateServiceRequestRulePrompt } from "./prompts/evaluate-service-request-rule-prompt";
import { routingToolRegistry } from "./routing-tools/routing-tool-registry";
import type { Bundle, QuestionnaireResponse, ServiceRequest } from "fhir/r4";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createEvaluateRuleService = (deps: Dependencies) => {
  const { cxt } = deps;

  function avoidProcessingDueToPatientOptOut(bundle: Bundle): boolean {
    const questionnaireResponse = bundle.entry?.find(
      (e) => e.resource?.resourceType === "QuestionnaireResponse"
    )?.resource as QuestionnaireResponse;
    // find the item with linkId "ai-opt-out"
    const optOutItemAnswer = questionnaireResponse?.item?.find(
      (i) => i.linkId === "ai_opt_out"
    )?.answer?.[0];
    return Boolean(
      optOutItemAnswer?.valueBoolean || optOutItemAnswer?.valueString === "true"
    );
  }

  async function evaluateRule({
    rule,
    routingEventMessage,
    eventType,
    requestDescription,
  }: {
    rule: RoutingRule;
    routingEventMessage: RoutingEventMessage;
    eventType: RoutingEventType;
    requestDescription: string;
  }): Promise<RuleEvaluationResult> {
    if (!rule.active) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        evaluation: {
          actions: [],
          triggered: false,
          comment: "The rule is inactive.",
        },
      };
    }
    if (rule.triggeringEvent !== eventType) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        evaluation: {
          actions: [],
          triggered: false,
          comment: "The rule is not triggered by this event type.",
        },
      };
    }
    const prompt = createEvaluationPrompt({
      rule,
      routingEventMessage,
      eventType,
    });

    cxt.logger.info(
      `Evaluating rule ${rule.name} for request ${requestDescription} with prompt:\n${prompt}`
    );

    try {
      const toolSet: ToolSet = Object.fromEntries(
        Object.values(routingToolRegistry)
          .filter((tool) =>
            toolSupportsEvent(
              tool as RoutingToolDefinition<RoutingToolName, ZodTypeAny>,
              eventType
            )
          )
          .filter((tool) =>
            rule.enabledTools.includes(tool.name as RoutingToolName)
          )
          .map((tool) => [
            tool.name,
            {
              inputSchema: tool.input,
              execute: async () => {
                // execution is handled in the routing service
              },
            },
          ])
      );

      // ask the AI for tool calls:
      const toolCalls: ToolCall[] = await cxt
        .getAiService()
        .getToolCalls(prompt, toolSet);
      cxt.logger.info(`Received tool calls for request ${requestDescription}`, {
        toolCalls: toolCalls.map((toolCall) => ({
          tool: toolCall.tool,
          params: JSON.stringify(toolCall.input),
        })),
      });

      const aiSuggestedActions: RoutingToolAction<RoutingToolName>[] =
        toolCalls.map((toolCall) => {
          return {
            id: uuid().toString(),
            tool: toolCall.tool as RoutingToolName,
            input: toolCall.input,
          };
        });

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        evaluation: {
          actions: aiSuggestedActions,
          triggered: aiSuggestedActions.length > 0,
          comment: aiSuggestedActions.length === 0 ? "The AI determined no actions were required." : undefined,
          prompt,
        },
      };
    } catch (error) {
      cxt.logger.error(
        `Error evaluating rule ${rule.name} at tenant ${rule.tenantId}: ${
          (error as Error).message
        }`,
        {
          error,
        }
      );
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        evaluation: {
          actions: [],
          triggered: true,
          error: `The AI engine returned an error: ${(error as Error).message}`,
        },
      };
    }
  }

  return {
    avoidProcessingDueToPatientOptOut,
    evaluateRule,
  };
};

function createEvaluationPrompt({
  rule,
  routingEventMessage,
  eventType,
}: {
  rule: RoutingRule;
  routingEventMessage: RoutingEventMessage;
  eventType: RoutingEventType;
}): string {
  if (isPatientEngagementEventMessage(routingEventMessage)) {
    return createEvaluatePEEventRulePrompt({
      rule,
      peEventMessage: routingEventMessage,
      eventType,
    });
  } else {
    return evaluateServiceRequestRulePrompt({
      rule,
      routingEventMessage: routingEventMessage as ServiceRequestEventMessage,
      eventType,
    });
  }
}

function toolSupportsEvent(
  tool: RoutingToolDefinition<RoutingToolName, ZodTypeAny>,
  eventType: RoutingEventType
): boolean {
  if (eventType === "request_pre_submission") {
    return tool.supportsCdsHook ?? false;
  } else {
    return tool.handler !== undefined;
  }
}
