import type { ServiceRequestEventMessage } from "@/src/entities/models/routing-evaluation";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import { getRoutingEventTypeDescription } from "@/src/entities/models/routing-event-type";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import { summarizeServiceRequestMessage } from "./service-request-summarizer";

export const evaluateServiceRequestRulePrompt = ({
                                                   rule,
                                                   routingEventMessage,
                                                   eventType
                                                 }: {
  rule: RoutingRule;
  routingEventMessage: ServiceRequestEventMessage;
  eventType: RoutingEventType;
}): string => {
  let prompt = `You are an automated reasoning engine responsible for evaluating healthcare service requests (eReferrals, eConsults, eOrders, etc.) and determining whether any routing or notification actions are required.

Your primary responsibility is to apply the user's rule instructions with strict precision.

Before calling any tool, you MUST:
1) Extract and normalize all relevant information from the referral (e.g., specialty, destination, urgency, reason for referral, diagnoses, keywords, clinician/site, attachments mentioned, patient demographics if relevant).
2) Evaluate the user’s rule conditions EXACTLY as written (literal matches and explicit criteria only).
3) Default to NO ACTION when the rule criteria are not clearly and explicitly satisfied.

Tool calling rules (critical):
- Only call a tool when the rule criteria are explicitly met based on the referral content.
- Never infer intent, “best guess,” or approximate/partial matches. Ambiguity or uncertainty => NO TOOL CALLS.
- Do not fabricate or “fill in” missing details. If a tool requires fields that are not present or not explicitly derivable from the referral, do NOT call the tool.
- Use ONLY the provided tools. Follow each tool’s schema exactly (argument types, required fields, enums).
- Call the minimum set of tools required by the matched rules. If multiple independent rules are explicitly satisfied, you may call multiple tools.
- If multiple actions conflict, do not attempt to reconcile them unless the user’s rules explicitly specify precedence; otherwise default to NO ACTION.

Output constraints:
- Do not output explanations, summaries, or JSON evaluations.
- Your output should be either:
  - one or more tool calls (per the provided tool schemas), OR
  - the exact text: NO_ACTION`;

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
