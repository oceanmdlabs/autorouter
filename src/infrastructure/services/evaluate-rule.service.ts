import type {
  RuleEvaluationResult,
  ServiceRequestMessage,
} from "@/src/entities/models/routing-evaluation";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import type {
  RoutingToolAction,
  RoutingToolDefinition,
} from "@/src/entities/models/routing-tool";
import type { ZodTypeAny } from "zod";
import type {
  ToolCall,
  ToolSet,
} from "@/src/application/services/ai.service.interface";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
import { createEvaluateRulePrompt } from "./prompts/evaluate-rule.prompt";
import { routingToolRegistry } from "./routing-tools/routing-tool-registry";
import { uuid } from "@/src/entities/models/uuid";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createEvaluateRuleService = (deps: Dependencies) => {
  const { cxt } = deps;

  async function evaluateRule({
    rule,
    serviceRequestMessage,
    eventType,
    referralRef,
  }: {
    rule: RoutingRule;
    serviceRequestMessage: ServiceRequestMessage;
    eventType: RoutingEventType;
    referralRef?: string;
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

    const prompt = createEvaluateRulePrompt({
      rule,
      serviceRequestMessage,
      eventType,
    });

    cxt.logger.info(
      `Evaluating rule ${rule.name} for request ${referralRef} with prompt:\n${prompt}`
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
      cxt.logger.info(`Received tool calls for request ${referralRef}`, {
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
          triggered: true,
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
    evaluateRule,
  };
};

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
