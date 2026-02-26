import type { PatientEngagementEventMessage } from "@/src/entities/models/patient-engagement-event-context";

export function summarizePEEvent(
  peEventContext: PatientEngagementEventMessage
): string {
  let summary = "\n\n";
  const patient = peEventContext.patient;
  // Patient information (excluding PII)
  summary += "## Patient:\n";
  summary += `Ocean Patient Ref: ${patient.ref}\n`;
  summary += `EMR Patient ID / MRN: ${patient.externalPatientRef}\n`;
  if (patient.reasonForVisit) {
    summary += `Reason For Visit: ${patient.reasonForVisit}\n`;
  }
  if (patient.apptReason) {
    summary += `Reason for Appointment: ${patient.apptReason}\n`;
  }
  if (patient.visitType) {
    summary += `Visit Type: ${patient.visitType}\n`;
  }
  const demographics = patient.demographics;
  if (demographics.language) {
    summary += `Language: ${patient.demographics.language}\n`;
  }
  summary += `Roster / Member Status (Enrolment Status): ${patient.demographics.memberStatus}\n`;
  if (patient.demographics.familyDoc) {
    summary += `Family Doc: ${JSON.stringify(
      patient.demographics.familyDoc
    )}\n`;
  }
  if (patient.demographics.clinicDoc) {
    summary += `Clinic Doc: ${JSON.stringify(
      patient.demographics.clinicDoc
    )}\n`;
  }
  if (patient.demographics.comments) {
    summary += `Patient Demographic Comments in the EMR: ${patient.demographics.comments}\n`;
  }
  if (patient.demographics.address.city) {
    summary += `City: ${patient.demographics.address.city}\n`;
  }
  if (patient.demographics.address.postalCode) {
    summary += `Postal Code (first 3 letters) : ${patient.demographics.address.postalCode?.slice(
      0,
      3
    )}\n`;
  }
  if (patient.cpp) {
    summary += `CPP: ${JSON.stringify(patient.cpp)}\n`;
  }
  if (patient.results) {
    summary += `Results: ${JSON.stringify(patient.results)}\n`;
  }
  if (patient.demographics.sex) {
    summary += `Sex / Gender: ${patient.demographics.sex}\n`;
  }
  if (patient.demographics.birthDate) {
    summary += `Age: ${calculateAge(
      patient.demographics.birthDate.toString()
    )}\n`;
  }
  const ptUpdate = peEventContext.note.ptUpdate;
  const progressNote = ptUpdate.progressNote;
  if (progressNote) {
    summary += `## Progress Note:\n`;
    summary += `Title: ${progressNote.title}\n`;
    summary += `Text: ${progressNote.text}\n`;
  }
  if (ptUpdate.completedForms) {
    summary += `## Answer map for completed forms:\n${JSON.stringify(
      ptUpdate.completedForms
    )}\n`;
  }

  return summary;
}

function calculateAge(birthDateStr: string) {
  const today = new Date();
  const birthDate = new Date(birthDateStr);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
