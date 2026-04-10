import type { ServiceRequestEventContext } from "./service-request-event-context";
import type { PatientEngagementEventContext } from "./patient-engagement-event-context";

export type RoutingEventContext =
  | PatientEngagementEventContext
  | ServiceRequestEventContext;
