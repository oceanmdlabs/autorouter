import { describe, expect, it, vi } from "vitest";
import type { Erequest } from "@/src/entities/models/erequest";
import type { OceanPatient } from "@/src/entities/models/ocean-patient";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import {
  matchArchivedErequestForPatient,
  normalizeHealthNumber,
  normalizeName,
  selectArchivedMatch,
} from "../match-archived-erequest";

function makeErequest(overrides: Partial<Erequest> = {}): Erequest {
  return {
    id: "er-1",
    tenantId: "tenant-1",
    messageChecksum: "checksum",
    triggeringEvent: "request_received",
    receivedAt: new Date("2026-01-01T00:00:00Z"),
    referralRef: "ref-1",
    patientHealthNumber: null,
    patientMedicalRecordNumber: null,
    patientName: null,
    patientFamilyName: null,
    patientGivenNames: null,
    patientDateOfBirth: new Date("1990-05-15"),
    healthServiceTypes: [],
    storageStatus: "stored",
    rawBundle: { resourceType: "Bundle" },
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "system",
    updatedBy: "system",
    ...overrides,
  } as Erequest;
}

describe("normalizeHealthNumber", () => {
  it("strips non-alphanumeric characters and upper-cases", () => {
    expect(normalizeHealthNumber("1234-567-890 on")).toBe("1234567890ON");
    expect(normalizeHealthNumber("  9876 543 21  ")).toBe("987654321");
    expect(normalizeHealthNumber(null)).toBe("");
  });
});

describe("normalizeName", () => {
  it("lower-cases, trims, collapses whitespace, and strips diacritics", () => {
    expect(normalizeName("  Renée   Côté ")).toBe("renee cote");
    expect(normalizeName("O'BRIEN")).toBe("o'brien");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("selectArchivedMatch", () => {
  const patient = {
    healthNumber: "1234-567-890",
    firstName: "Jane",
    surname: "Doe",
  };

  it("matches on normalized medical record number + DOB first", () => {
    const candidates = [
      makeErequest({ id: "a", patientMedicalRecordNumber: "MRN-001" }),
      makeErequest({ id: "b", patientMedicalRecordNumber: "MRN-999" }),
    ];
    const result = selectArchivedMatch(candidates, {
      medicalRecordNumber: "mrn001",
      healthNumber: "1234-567-890",
      firstName: "Jane",
      surname: "Doe",
    });
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.match.id).toBe("a");
    expect(result.strategy).toBe("mrn_dob");
  });

  it("prefers MRN over health number when both are present", () => {
    const candidates = [
      // Same HN, but MRN points to a different (correct) referral.
      makeErequest({
        id: "by-hn",
        patientHealthNumber: "1234567890",
        patientMedicalRecordNumber: "MRN-OTHER",
      }),
      makeErequest({
        id: "by-mrn",
        patientHealthNumber: "0000000000",
        patientMedicalRecordNumber: "MRN-001",
      }),
    ];
    const result = selectArchivedMatch(candidates, {
      medicalRecordNumber: "MRN-001",
      healthNumber: "1234-567-890",
      firstName: "Jane",
      surname: "Doe",
    });
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.match.id).toBe("by-mrn");
    expect(result.strategy).toBe("mrn_dob");
  });

  it("falls back to health number when MRN finds no candidate", () => {
    const candidates = [
      makeErequest({
        id: "a",
        patientHealthNumber: "1234567890",
        patientMedicalRecordNumber: "MRN-OTHER",
      }),
    ];
    const result = selectArchivedMatch(candidates, {
      medicalRecordNumber: "MRN-MISSING",
      healthNumber: "1234-567-890",
      firstName: "Jane",
      surname: "Doe",
    });
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.strategy).toBe("hn_dob");
    expect(result.match.id).toBe("a");
  });

  it("matches on normalized health number + DOB", () => {
    const candidates = [
      makeErequest({ id: "a", patientHealthNumber: "1234567890" }),
      makeErequest({ id: "b", patientHealthNumber: "9999999999" }),
    ];
    const result = selectArchivedMatch(candidates, patient);
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.match.id).toBe("a");
    expect(result.strategy).toBe("hn_dob");
    expect(result.usedRecencyHeuristic).toBe(false);
  });

  it("falls back to name + DOB when no health number is available", () => {
    const candidates = [
      makeErequest({
        id: "a",
        patientHealthNumber: null,
        patientGivenNames: "Jane Mary",
        patientFamilyName: "Doe",
      }),
    ];
    const result = selectArchivedMatch(candidates, {
      healthNumber: null,
      firstName: "Jane",
      surname: "Doe",
    });
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.match.id).toBe("a");
    expect(result.strategy).toBe("name_dob");
  });

  it("falls back to name + DOB when health number finds no candidate", () => {
    const candidates = [
      makeErequest({
        id: "a",
        patientHealthNumber: "0000000000",
        patientGivenNames: "Jane",
        patientFamilyName: "Doe",
      }),
    ];
    const result = selectArchivedMatch(candidates, patient);
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.strategy).toBe("name_dob");
    expect(result.match.id).toBe("a");
  });

  it("returns none when nothing matches", () => {
    const candidates = [
      makeErequest({
        id: "a",
        patientHealthNumber: "0000000000",
        patientGivenNames: "Bob",
        patientFamilyName: "Smith",
      }),
    ];
    expect(selectArchivedMatch(candidates, patient).status).toBe("none");
  });

  it("returns none for an empty candidate list", () => {
    expect(selectArchivedMatch([], patient).status).toBe("none");
  });

  it("selects the most recently received referral on multiple matches", () => {
    const candidates = [
      makeErequest({
        id: "old",
        patientHealthNumber: "1234567890",
        receivedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      makeErequest({
        id: "new",
        patientHealthNumber: "1234567890",
        receivedAt: new Date("2026-03-01T00:00:00Z"),
      }),
      makeErequest({
        id: "mid",
        patientHealthNumber: "1234567890",
        receivedAt: new Date("2026-02-01T00:00:00Z"),
      }),
    ];
    const result = selectArchivedMatch(candidates, patient);
    expect(result.status).toBe("multiple");
    if (result.status === "none") throw new Error("expected match");
    expect(result.match.id).toBe("new");
    expect(result.candidateCount).toBe(3);
    expect(result.usedRecencyHeuristic).toBe(true);
  });
});

describe("matchArchivedErequestForPatient", () => {
  function makePatient(
    overrides: Partial<OceanPatient["demographics"]> = {},
    externalPatientRef = ""
  ): OceanPatient {
    return {
      ref: "pt-1",
      externalPatientRef,
      demographics: {
        hn: "1234-567-890",
        birthDate: "1990-05-15",
        firstName: "Jane",
        surname: "Doe",
        ...overrides,
      },
    } as unknown as OceanPatient;
  }

  function makeCxt(candidates: Erequest[]) {
    const findInbound = vi.fn().mockResolvedValue(candidates);
    const cxt = {
      getErequestsRepository: () => ({
        findInboundReceivedByDateOfBirth: findInbound,
      }),
    } as unknown as ApplicationContext;
    return { cxt, findInbound };
  }

  it("returns none when the patient has no date of birth", async () => {
    const { cxt, findInbound } = makeCxt([]);
    const result = await matchArchivedErequestForPatient(
      makePatient({ birthDate: "" }),
      cxt
    );
    expect(result.status).toBe("none");
    expect(findInbound).not.toHaveBeenCalled();
  });

  it("queries by DOB and returns the matched referral", async () => {
    const { cxt, findInbound } = makeCxt([
      makeErequest({ id: "a", patientHealthNumber: "1234567890" }),
    ]);
    const result = await matchArchivedErequestForPatient(makePatient(), cxt);
    expect(findInbound).toHaveBeenCalledWith(new Date("1990-05-15"));
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.match.id).toBe("a");
  });

  it("matches on the patient's external (EMR) reference as MRN", async () => {
    const { cxt } = makeCxt([
      makeErequest({ id: "a", patientMedicalRecordNumber: "MRN-001" }),
    ]);
    const result = await matchArchivedErequestForPatient(
      makePatient({}, "MRN-001"),
      cxt
    );
    expect(result.status).toBe("single");
    if (result.status === "none") throw new Error("expected match");
    expect(result.strategy).toBe("mrn_dob");
    expect(result.match.id).toBe("a");
  });
});
