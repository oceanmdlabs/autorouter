import { assignTool } from "./assign";
import { changeStatusTool } from "./change-status";
import { forwardTool } from "./forward";
import { sendCommunicationTool } from "./send-communication-to-requester";
import { sendSmsTool } from "./send-sms";
import { setBookingInstructionsTool } from "./set-booking-instructions";
import { toggleEConsultTool } from "./toggle-econsult";
import { updateCategoryTool } from "./update-category";
import { showCdsCardTool } from "./show-cds-card";
import { markAsNeedsReviewTool } from "./mark-as-needs-review";
import { summarizeAttachmentsTool } from "./summarize-attachments";
import { sendEmailTool } from "./send-email";
import { commentTool } from "./comment";

export const routingToolRegistry = {
  sendCommunicationToRequester: sendCommunicationTool,
  changeStatus: changeStatusTool,
  setBookingInstructions: setBookingInstructionsTool,
  toggleEConsult: toggleEConsultTool,
  updateCategory: updateCategoryTool,
  forward: forwardTool,
  assign: assignTool,
  sendSms: sendSmsTool,
  showCdsCard: showCdsCardTool,
  markAsNeedsReview: markAsNeedsReviewTool,
  summarizeAttachments: summarizeAttachmentsTool,
  sendEmail: sendEmailTool,
  comment: commentTool,
};

export type RoutingToolRegistry = typeof routingToolRegistry;
export type RoutingToolName = keyof RoutingToolRegistry;
