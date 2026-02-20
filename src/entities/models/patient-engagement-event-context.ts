import {
  type OceanPatient,
  type PatientNote,
  type ProgressNote,
} from "./ocean-patient";
import type { RoutingEventMessage } from "./routing-evaluation";

export type PatientEngagementEventType =
  | "patient_message_forms_completion"
  | "patient_note_added";

export type PatientEngagementEventContext = {
  triggeringEvent: PatientEngagementEventType;
  message: PatientEngagementEventMessage;
};

export type PatientEngagementEventMessage = {
  oceanSessionId: string;
  patient: OceanPatient;
  note: PatientNote;
};

export function getPatientEngagementEventContextDescription(
  eventContext: PatientEngagementEventContext
) {
  return `Triggering event: ${eventContext.triggeringEvent}\nPatient ref: ${eventContext.message.patient.ref}\noceanSessionId: ${eventContext.message.oceanSessionId}`;
}

export function isPatientEngagementEventMessage(
  eventMessage: RoutingEventMessage
): eventMessage is PatientEngagementEventMessage {
  return (eventMessage as PatientEngagementEventMessage).patient !== undefined;
}
