import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export interface ClientRoutingTool {
  name: RoutingToolName;
  description: string;
  briefDescription?: string;
  supportsCdsHook?: boolean;
}

export const clientRoutingToolRegistry: Record<
  RoutingToolName,
  ClientRoutingTool
> = {
  sendCommunicationToRequester: {
    name: "sendCommunicationToRequester",
    description: "Send a message to the referrer",
  },
  changeStatus: {
    name: "changeStatus",
    description: "Accept, decline, or complete the request",
  },
  setBookingInstructions: {
    name: "setBookingInstructions",
    description: "Provide booking instructions",
  },
  toggleEConsult: {
    name: "toggleEConsult",
    description: "Change an eReferral to an eConsult or vice versa",
  },
  updateCategory: {
    name: "updateCategory",
    description: "Update the health service category of the request",
  },
  forward: {
    name: "forward",
    description: "Forward the request to a specific listing",
  },
  assign: {
    name: "assign",
    description: "Assign the request to a specific provider",
  },
  sendSms: {
    name: "sendSms",
    description: "Send an SMS message",
  },
  showCdsCard: {
    name: "showCdsCard",
    description:
      "Provide advice, warnings, or errors regarding the submission (via CDS Hooks)",
    supportsCdsHook: true,
  },
  markAsNeedsReview: {
    name: "markAsNeedsReview",
    description: "Mark a service request as needing review with a message",
  },
  summarizeAttachments: {
    name: "summarizeAttachments",
    description: "Analyze and summarize information from attachments using AI",
  },
  sendEmail: {
    name: "sendEmail",
    description: "Send an email message to the specified recipient",
  },
  comment: {
    name: "comment",
    description: "Add a comment to the Autorouter's Activity Log",
  },
};

export const routingToolNames = Object.keys(
  clientRoutingToolRegistry
) as RoutingToolName[];
