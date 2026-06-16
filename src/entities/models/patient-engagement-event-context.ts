import type { Bundle } from "fhir/r4";
import {
  type OceanPatient,
  type PatientNote,
  type ProgressNote,
} from "./ocean-patient";
import type { RoutingEventMessage } from "./routing-evaluation";

export type PatientEngagementEventType =
  | "patient_message_forms_completion"
  | "patient_note_added"
  | "intake_questionnaire_completed";

/**
 * Metadata about an archived inbound eRequest that was matched to a completed
 * intake questionnaire. Surfaced to the rule LLM as context for the
 * `intake_questionnaire_completed` event.
 */
export type MatchedErequest = {
  erequestId: string;
  referralRef?: string | null;
  receivedAt: Date;
  requestedListingTitle?: string | null;
  /** The archived referral's raw FHIR bundle, used to summarize it for the LLM. */
  serviceRequestBundle?: Bundle;
};

export type PatientEngagementEventContext = {
  triggeringEvent: PatientEngagementEventType;
  message: PatientEngagementEventMessage;
  /**
   * For `intake_questionnaire_completed` events, the matched archived eRequest's
   * raw FHIR bundle, exposed so existing service-request tools can target the
   * referral via the `"serviceRequestBundle" in eventContext` check.
   */
  serviceRequestBundle?: Bundle;
  referralRef?: string;
};

export type PatientEngagementEventMessage = {
  oceanSessionId: string;
  patient: OceanPatient;
  note: PatientNote;
  /** Present only for `intake_questionnaire_completed` events. */
  matchedErequest?: MatchedErequest;
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
