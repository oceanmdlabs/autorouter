import { z } from "zod";

export const routingEventTypeEnum = [
  "request_pre_submission",
  "request_received",
  "request_updated", // avoid supporting this for now, since it's noisy and triggers infinite recursive processing with Ocean
  "request_cancelled",
  "request_accepted",
  "request_declined",
  "request_message",
] as const;

export const routingEventTypeSchema = z.enum(routingEventTypeEnum);
export type RoutingEventType = z.infer<typeof routingEventTypeSchema>;

export function getRoutingEventTypeDescription(
  eventType?: RoutingEventType | null
) {
  if (!eventType) {
    return "An unknown event has occurred.";
  }
  switch (eventType) {
    case "request_pre_submission":
      return "An new eRequest is about to be submitted.";
    case "request_received":
      return "A new eRequest is received.";
    case "request_updated":
      return "An eRequest was updated.";
    case "request_cancelled":
      return "An eRequest was cancelled.";
    case "request_accepted":
      return "An eRequest was accepted.";
    case "request_declined":
      return "An eRequest was declined.";
    case "request_message":
      return "An eRequest has received a new message.";
  }
}
export function getRoutingEventTypeTitle(eventType?: RoutingEventType | null) {
  if (!eventType) {
    return "Unknown";
  }
  switch (eventType) {
    case "request_pre_submission":
      return "Pre-submission check";
    case "request_received":
      return "New request";
    case "request_updated":
      return "Updated request";
    case "request_cancelled":
      return "Cancelled request";
    case "request_accepted":
      return "Accepted request";
    case "request_declined":
      return "Declined request";
    case "request_message":
      return "New message";
  }
}
