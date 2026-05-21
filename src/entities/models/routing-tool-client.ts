import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export interface ClientRoutingTool {
  name: RoutingToolName;
  description: string;
  briefDescription?: string;
  supportsCdsHook?: boolean;
  actionType?: string;
  getActionTaken?: (input: Record<string, any>) => string;
}

export const clientRoutingToolRegistry: Record<
  RoutingToolName,
  ClientRoutingTool
> = {
  sendCommunicationToRequester: {
    name: "sendCommunicationToRequester",
    description: "Send a message to the referrer",
    actionType: "Send Communication",
    getActionTaken: () => "Message sent to referrer",
  },
  changeStatus: {
    name: "changeStatus",
    description: "Accept, decline, or complete the request",
    actionType: "Change Status",
    getActionTaken: (input) =>
      input.status === "accepted"
        ? "Request accepted"
        : input.status === "rejected"
          ? "Request declined"
          : "Request completed",
  },
  setBookingInstructions: {
    name: "setBookingInstructions",
    description: "Provide booking instructions",
    actionType: "Set Booking Instructions",
    getActionTaken: () => "Booking instructions set",
  },
  toggleEConsult: {
    name: "toggleEConsult",
    description: "Change an eReferral to an eConsult or vice versa",
    actionType: "Toggle eConsult",
    getActionTaken: () => "eConsult toggled",
  },
  updateCategory: {
    name: "updateCategory",
    description: "Update the health service category of the request",
    actionType: "Update Category",
    getActionTaken: (input) =>
      `Category updated to ${input.category ?? ""}`,
  },
  forward: {
    name: "forward",
    description: "Forward the request to a specific listing",
    actionType: "Forward",
    getActionTaken: () => "Request forwarded",
  },
  assign: {
    name: "assign",
    description: "Assign the request to a specific provider",
    actionType: "Assign",
    getActionTaken: () => "Request assigned",
  },
  sendSms: {
    name: "sendSms",
    description: "Send an SMS message",
    actionType: "Send SMS",
    getActionTaken: (input) => `SMS sent to ${input.phoneNumber ?? ""}`,
  },
  showCdsCard: {
    name: "showCdsCard",
    description:
      "Provide advice, warnings, or errors regarding the submission (via CDS Hooks)",
    supportsCdsHook: true,
    actionType: "Show CDS Card",
    getActionTaken: (input) => `CDS card shown: ${input.summary ?? ""}`,
  },
  markAsNeedsReview: {
    name: "markAsNeedsReview",
    description: "Mark a service request as needing review with a message",
    actionType: "Flag for Review",
    getActionTaken: () => "Marked as needs review",
  },
  summarizeAttachments: {
    name: "summarizeAttachments",
    description: "Analyze and summarize information from attachments using AI",
    actionType: "Summarize Attachments",
    getActionTaken: () => "Attachments summarized",
  },
  sendEmail: {
    name: "sendEmail",
    description: "Send an email message to the specified recipient",
    actionType: "Send Email",
    getActionTaken: (input) =>
      [`To: ${input.to ?? ""}`, input.subject ? `Subject: ${input.subject}` : null, input.message ? `Message: ${input.message}` : null]
        .filter(Boolean)
        .join("\n"),
  },
  comment: {
    name: "comment",
    description: "Add a comment to the Autorouter's Activity Log",
    actionType: "Add Comment",
    getActionTaken: () => "Comment added",
  },
};

export const routingToolNames = Object.keys(
  clientRoutingToolRegistry
) as RoutingToolName[];
