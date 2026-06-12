import type { ServiceRequestEventMessage } from "@/src/entities/models/routing-evaluation";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import { getRoutingEventTypeDescription } from "@/src/entities/models/routing-event-type";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import { summarizeServiceRequestMessage } from "./service-request-summarizer";

export const evaluateServiceRequestRulePrompt = ({
  rule,
  routingEventMessage,
  eventType,
}: {
  rule: RoutingRule;
  routingEventMessage: ServiceRequestEventMessage;
  eventType: RoutingEventType;
}): string => {
  let prompt = `You are an intelligent automated routing engine for healthcare service requests such as eReferrals, eConsults, eOrders and eConsults.
In response to events related to these service requests, you can use the following tools to follow the user instructions.
IMPORTANT: Only call a tool if the referral content EXPLICITLY and DIRECTLY meets the criteria in the user's instructions. Do NOT infer, speculate, or trigger based on potential, possible, or indirect matches. If the criteria are not clearly and unambiguously met by the actual referral content, do nothing. When in doubt, do nothing.`;

  prompt +=
    "\n\n** AN EVENT HAS OCCURRED: " +
    getRoutingEventTypeDescription(eventType) +
    " **";
  prompt += summarizeServiceRequestMessage(routingEventMessage, rule.allowedContextFields ?? []);

  prompt +=
    "\n\nThe user has instructed you to do the following:\n-- BEGIN USER INSTRUCTIONS --\n" +
    rule.prompt +
    "\n-- END USER INSTRUCTIONS --";

  prompt += "\n\nBefore calling any tools, briefly explain in 1-3 sentences whether the rule criteria are met and why, then call the appropriate tools or do nothing.";

  return prompt;
};
