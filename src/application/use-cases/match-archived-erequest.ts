import type { ApplicationContext } from "@/src/entities/models/application-context";
import type { Erequest } from "@/src/entities/models/erequest";
import type { OceanPatient } from "@/src/entities/models/ocean-patient";

/**
 * Matches a completed Patient Engagement intake questionnaire to an archived
 * inbound eReferral/eConsult for the same patient.
 *
 * Strategy (see docs/rule-execution-design.md), strongest key first:
 *   1. exact normalized medical record number (EMR patient reference) + date of
 *      birth — the strongest available key within a tenant's EMR; then
 *   2. exact normalized health number + date of birth; then
 *   3. normalized first name + surname + date of birth, when the stronger
 *      identifiers are unavailable or find no candidate.
 *
 * A date of birth is required for any match. When more than one archived inbound
 * referral matches, the most recently received one is selected and the recency
 * heuristic is flagged.
 */

export type ArchivedMatchStrategy = "mrn_dob" | "hn_dob" | "name_dob";

export type ArchivedMatchResult =
  | { status: "none" }
  | {
      status: "single" | "multiple";
      match: Erequest;
      strategy: ArchivedMatchStrategy;
      candidateCount: number;
      usedRecencyHeuristic: boolean;
    };

/** Strips non-alphanumeric characters and upper-cases. e.g. "1234-567-890 ON" -> "1234567890ON". */
export function normalizeIdentifier(value?: string | null): string {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/** @deprecated use {@link normalizeIdentifier}; retained for clarity at health-number call sites. */
export const normalizeHealthNumber = normalizeIdentifier;

/** Trims, lower-cases, collapses whitespace, and strips diacritics. */
export function normalizeName(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Selects the best archived match from a candidate list already filtered by date
 * of birth. Candidates are expected to be ordered by `receivedAt` descending, but
 * this function re-derives the most recent one defensively.
 */
export function selectArchivedMatch(
  candidates: Erequest[],
  patient: {
    medicalRecordNumber?: string | null;
    healthNumber?: string | null;
    firstName?: string | null;
    surname?: string | null;
  }
): ArchivedMatchResult {
  const normalizedMrn = normalizeIdentifier(patient.medicalRecordNumber);
  const normalizedHn = normalizeIdentifier(patient.healthNumber);
  const normalizedFirst = normalizeName(patient.firstName);
  const normalizedSurname = normalizeName(patient.surname);

  let matches: Erequest[] = [];
  let strategy: ArchivedMatchStrategy | undefined;

  if (normalizedMrn) {
    const mrnMatches = candidates.filter(
      (c) => normalizeIdentifier(c.patientMedicalRecordNumber) === normalizedMrn
    );
    if (mrnMatches.length > 0) {
      matches = mrnMatches;
      strategy = "mrn_dob";
    }
  }

  if (matches.length === 0 && normalizedHn) {
    const hnMatches = candidates.filter(
      (c) => normalizeIdentifier(c.patientHealthNumber) === normalizedHn
    );
    if (hnMatches.length > 0) {
      matches = hnMatches;
      strategy = "hn_dob";
    }
  }

  if (matches.length === 0 && normalizedFirst && normalizedSurname) {
    const nameMatches = candidates.filter(
      (c) =>
        normalizeName(c.patientGivenNames).startsWith(normalizedFirst) &&
        normalizeName(c.patientFamilyName) === normalizedSurname
    );
    if (nameMatches.length > 0) {
      matches = nameMatches;
      strategy = "name_dob";
    }
  }

  if (matches.length === 0 || !strategy) {
    return { status: "none" };
  }

  const mostRecent = matches.reduce((latest, current) =>
    current.receivedAt > latest.receivedAt ? current : latest
  );

  return {
    status: matches.length > 1 ? "multiple" : "single",
    match: mostRecent,
    strategy,
    candidateCount: matches.length,
    usedRecencyHeuristic: matches.length > 1,
  };
}

/**
 * Tenant-scoped matcher: reads the patient's demographics, fetches archived
 * inbound referrals sharing the same date of birth, and selects the best match.
 */
export async function matchArchivedErequestForPatient(
  patient: OceanPatient,
  cxt: ApplicationContext
): Promise<ArchivedMatchResult> {
  const birthDateStr = patient.demographics?.birthDate;
  if (!birthDateStr) {
    return { status: "none" };
  }
  const dob = new Date(birthDateStr);
  if (Number.isNaN(dob.getTime())) {
    return { status: "none" };
  }

  const candidates = await cxt
    .getErequestsRepository()
    .findInboundReceivedByDateOfBirth(dob);

  return selectArchivedMatch(candidates, {
    medicalRecordNumber: patient.externalPatientRef,
    healthNumber: patient.demographics?.hn,
    firstName: patient.demographics?.firstName,
    surname: patient.demographics?.surname,
  });
}
