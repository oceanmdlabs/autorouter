import type { Bundle } from "fhir/r4";
import { type RoutingEventType } from "./routing-event-type";
import type { Attachment } from "./attachment";

export type ServiceRequestEventContext = {
  serviceRequestBundle: Bundle;
  triggeringEvent: RoutingEventType;
  referralRef?: string;
  requestingProvider?: string;
  requestedListingTitle?: string;
  requestedListingRef?: string;
  requestedServiceDescription?: string;
  attachments?: Attachment[];
  details?: string;
  archivalMessage?: string;
  archivalError?: string;
};

export function getServiceRequestEventContextDescription(
  eventContext: ServiceRequestEventContext
) {
  return `Triggering event: ${eventContext.triggeringEvent}\nReferral ref: ${eventContext.referralRef}\nRequesting provider: ${eventContext.requestingProvider}\nRequested listing title: ${eventContext.requestedListingTitle}\nRequested listing ref: ${eventContext.requestedListingRef}\nRequested offering title: ${eventContext.requestedServiceDescription}\nDetails: ${eventContext.details}`;
}
