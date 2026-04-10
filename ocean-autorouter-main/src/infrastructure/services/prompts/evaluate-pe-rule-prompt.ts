import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import { getRoutingEventTypeDescription } from "@/src/entities/models/routing-event-type";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import { summarizePEEvent } from "./pe-event-summarizer";
import type { PatientEngagementEventMessage } from "@/src/entities/models/patient-engagement-event-context";

export const createEvaluatePEEventRulePrompt = ({
  rule,
  peEventMessage,
  eventType,
}: {
  rule: RoutingRule;
  peEventMessage: PatientEngagementEventMessage;
  eventType: RoutingEventType;
}): string => {
  let prompt = `You are an intelligent automated routing engine for Ocean Patient Engagement events.
When triggered by these patient engagement events, you can use the following tools to follow the user instructions.
Only call a tool if you are confident that the user's instructions require it. It is perfectly fine to do nothing.`;

  prompt +=
    "\n\n** AN EVENT HAS OCCURRED: " +
    getRoutingEventTypeDescription(eventType) +
    " **";
  prompt += summarizePEEvent(peEventMessage);

  prompt +=
    "\n\nThe user has instructed you to do the following:\n-- BEGIN USER INSTRUCTIONS --\n" +
    rule.prompt +
    "\n-- END USER INSTRUCTIONS --";

  return prompt;
};
