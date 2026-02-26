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
Only call a tool if you are confident that the user's instructions require it. It is perfectly fine to do nothing.`;

  prompt +=
    "\n\n** AN EVENT HAS OCCURRED: " +
    getRoutingEventTypeDescription(eventType) +
    " **";
  prompt += summarizeServiceRequestMessage(routingEventMessage);

  prompt +=
    "\n\nThe user has instructed you to do the following:\n-- BEGIN USER INSTRUCTIONS --\n" +
    rule.prompt +
    "\n-- END USER INSTRUCTIONS --";

  return prompt;
};
