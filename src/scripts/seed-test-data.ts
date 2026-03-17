import * as dotenv from "dotenv";
dotenv.config();

import { createHash } from "node:crypto";
import type {
  Bundle,
  ContactPoint,
  DocumentReference,
  Patient,
  Practitioner,
  PractitionerRole,
  ServiceRequest,
} from "fhir/r4";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { HealthcareService, NewHealthcareService } from "@/src/entities/models/healthcare-service";
import type { Erequest, NewErequest, UpdateErequest } from "@/src/entities/models/erequest";
import type { ErequestBlob } from "@/src/entities/models/erequest-blob";
import type { NewRoutingRule, RoutingRule } from "@/src/entities/models/routing-rule";
import type { NewTestServiceRequest, TestServiceRequest } from "@/src/entities/models/test-service-request";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

const logger = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  log: console.log,
};

type Args = {
  tenantId: string;
  userId: string;
};

type SeedAttachment = {
  title: string;
  description: string;
  url: string;
};

type SeedBlob = {
  filename: string;
  kind: "primary_pdf" | "attachment";
  summary: string;
};

type RequestSeed = {
  identifier: string;
  patientGivenName: string;
  patientFamilyName: string;
  patientBirthDate: string;
  patientGender: "male" | "female" | "other" | "unknown";
  patientPostalCode: string;
  patientPhone?: string;
  patientEmail?: string;
  patientHealthNumber: string;
  patientMedicalRecordNumber: string;
  referrerGivenName: string;
  referrerFamilyName: string;
  requestedListingTitle: string;
  requestedListingRef: string;
  healthServiceCategory: string;
  referralSummary: string;
  receivedAt: string;
  referralRef: string;
  sourceMessageId: string;
  includeSampleBundle?: boolean;
  includeRawBundle?: boolean;
  bundleAttachments?: SeedAttachment[];
  archivedBlobs?: SeedBlob[];
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let tenantId =
    process.env.SEED_TENANT_ID ??
    process.env.TENANT_ID ??
    process.env.AUTH_TENANT_ID ??
    "";
  let userId = process.env.SEED_USER_ID ?? "seed-script";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (arg === "--tenant-id" && nextValue) {
      tenantId = nextValue;
      index += 1;
      continue;
    }

    if (arg === "--user-id" && nextValue) {
      userId = nextValue;
      index += 1;
    }
  }

  if (!tenantId) {
    throw new Error(
      "Missing tenant id. Pass --tenant-id <tenant-id> or set SEED_TENANT_ID."
    );
  }

  return { tenantId, userId };
}

function checksum(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableMessageChecksum(seed: RequestSeed) {
  return checksum(`seed-erequest:${seed.referralRef}:${seed.sourceMessageId}`);
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(value: string, lineLength = 72) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > lineLength) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function createPlaceholderPdf(seed: RequestSeed, blob: SeedBlob) {
  const lines = [
    "Ocean Autorouter Seeded Referral Letter",
    `Patient: ${seed.patientGivenName} ${seed.patientFamilyName}`,
    `Referral Ref: ${seed.referralRef}`,
    `Requested Listing: ${seed.requestedListingTitle}`,
    `Referrer: Dr. ${seed.referrerGivenName} ${seed.referrerFamilyName}`,
    `Received: ${seed.receivedAt}`,
    "",
    ...wrapText(blob.summary, 78),
  ];

  const textCommands = lines
    .map((line, index) => `${index === 0 ? "72 720 Td" : "0 -18 Td"} (${escapePdfText(line)}) Tj`)
    .join("\n");

  const stream = `BT
/F1 12 Tf
${textCommands}
ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
${offsets
  .slice(1)
  .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n `)
  .join("\n")}
trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function buildBundle(seed: RequestSeed): Bundle {
  const patientTelecom: ContactPoint[] = [
    ...(seed.patientPhone
      ? [{ system: "phone", value: seed.patientPhone } as ContactPoint]
      : []),
    ...(seed.patientEmail
      ? [{ system: "email", value: seed.patientEmail } as ContactPoint]
      : []),
  ];

  const patient: Patient = {
    resourceType: "Patient",
    id: "patient-1",
    identifier: [
      {
        system: "http://ocean.local/mock/health-number",
        value: seed.patientHealthNumber,
      },
      {
        system: "http://ocean.local/mock/mrn",
        value: seed.patientMedicalRecordNumber,
      },
    ],
    name: [
      {
        given: [seed.patientGivenName],
        family: seed.patientFamilyName,
      },
    ],
    birthDate: seed.patientBirthDate,
    gender: seed.patientGender,
    telecom: patientTelecom,
    address: [
      {
        postalCode: seed.patientPostalCode,
        city: "Toronto",
        state: "ON",
        country: "CA",
      },
    ],
  };

  const practitioner: Practitioner = {
    resourceType: "Practitioner",
    id: "practitioner-1",
    name: [
      {
        given: [seed.referrerGivenName],
        family: seed.referrerFamilyName,
      },
    ],
  };

  const practitionerRole: PractitionerRole = {
    resourceType: "PractitionerRole",
    id: "practitioner-role-1",
    practitioner: {
      reference: "Practitioner/practitioner-1",
    },
  };

  const serviceRequest: ServiceRequest = {
    resourceType: "ServiceRequest",
    id: "service-request-1",
    status: "active",
    intent: "order",
    subject: {
      reference: "Patient/patient-1",
    },
    requester: {
      reference: "PractitionerRole/practitioner-role-1",
    },
    code: {
      text: seed.healthServiceCategory,
    },
    orderDetail: [{ text: seed.healthServiceCategory }],
    text: {
      status: "generated",
      div: seed.referralSummary,
    },
    supportingInfo:
      seed.bundleAttachments?.map((_, index) => ({
        reference: `DocumentReference/document-${index + 1}`,
      })) ?? [],
  };

  const documents: DocumentReference[] =
    seed.bundleAttachments?.map((attachment, index) => ({
      resourceType: "DocumentReference",
      id: `document-${index + 1}`,
      status: "current",
      description: attachment.description,
      content: [
        {
          attachment: {
            contentType: "application/pdf",
            title: attachment.title,
            url: attachment.url,
          },
        },
      ],
    })) ?? [];

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: seed.receivedAt,
    identifier: {
      system: "http://ocean.local/mock/request-name",
      value: seed.identifier,
    },
    entry: [
      { fullUrl: "Patient/patient-1", resource: patient },
      { fullUrl: "Practitioner/practitioner-1", resource: practitioner },
      {
        fullUrl: "PractitionerRole/practitioner-role-1",
        resource: practitionerRole,
      },
      {
        fullUrl: "ServiceRequest/service-request-1",
        resource: serviceRequest,
      },
      ...documents.map((document, index) => ({
        fullUrl: `DocumentReference/document-${index + 1}`,
        resource: document,
      })),
    ],
  };
}

function toNewErequest(seed: RequestSeed, bundle: Bundle | null): NewErequest {
  const hasBlobs = (seed.archivedBlobs?.length ?? 0) > 0;
  return {
    sourceMessageId: seed.sourceMessageId,
    messageChecksum: stableMessageChecksum(seed),
    referralRef: seed.referralRef,
    triggeringEvent: "request_received",
    receivedAt: new Date(seed.receivedAt),
    patientHealthNumber: seed.patientHealthNumber,
    patientMedicalRecordNumber: seed.patientMedicalRecordNumber,
    patientName: `${seed.patientGivenName} ${seed.patientFamilyName}`,
    patientFamilyName: seed.patientFamilyName,
    patientGivenNames: seed.patientGivenName,
    patientDateOfBirth: new Date(`${seed.patientBirthDate}T00:00:00.000Z`),
    referringProvider: `Dr. ${seed.referrerGivenName} ${seed.referrerFamilyName}`,
    receivingProvider: seed.requestedListingTitle,
    requestedListingRef: seed.requestedListingRef,
    requestedListingTitle: seed.requestedListingTitle,
    healthServiceTypes: [seed.healthServiceCategory],
    requestedServiceDescription: seed.referralSummary,
    rawBundle: bundle,
    primaryBlobId: null,
    storageStatus: hasBlobs ? "pending" : "stored",
    ingestionError: null,
  };
}

async function seedListings(
  existingListings: HealthcareService[],
  cxt: ApplicationContext
) {
  const listings: NewHealthcareService[] = [
    {
      name: "Chest Pain Clinic",
      description:
        "Rapid assessment listing for referrals with chest pain or suspected angina symptoms.",
      oceanReference: "CHESTPAINCLINIC",
    },
    {
      name: "SHSC",
      description:
        "Routing destination for requests whose postal code begins with the SHSC service area prefix.",
      oceanReference: "SHSC",
    },
    {
      name: "General Cardiology Intake",
      description:
        "Standard cardiology intake listing for non-urgent referrals and consults.",
      oceanReference: "GENCARDIOLOGY",
    },
    {
      name: "General Internal Medicine",
      description:
        "General medicine triage listing used as a default destination in seed data.",
      oceanReference: "GENMEDICINE",
    },
    {
      name: "Neurology Rapid Access",
      description:
        "Rapid access neurology listing for headaches, neuropathy, and dizziness referrals.",
      oceanReference: "NEURORAPID",
    },
    {
      name: "Gastroenterology Intake",
      description:
        "Standard gastroenterology intake listing for abdominal pain and anemia referrals.",
      oceanReference: "GIINTAKE",
    },
  ];

  const repository = cxt.getHealthcareServicesRepository();
  for (const listing of listings) {
    const existing = existingListings.find(
      (item) =>
        item.oceanReference === listing.oceanReference || item.name === listing.name
    );

    if (existing) {
      await repository.update({
        id: existing.id,
        name: listing.name,
        description: listing.description,
        oceanReference: listing.oceanReference,
      });
      logger.info(`Updated listing: ${listing.name}`);
    } else {
      await repository.create(listing);
      logger.info(`Created listing: ${listing.name}`);
    }
  }

  return listings.length;
}

async function seedRules(existingRules: RoutingRule[], cxt: ApplicationContext) {
  const rules: Array<NewRoutingRule & { matchName: string }> = [
    {
      matchName: "Acute Safety SMS Alert",
      name: "Acute Safety SMS Alert",
      triggeringEvent: "request_received",
      enabledTools: ["sendSms"],
      active: true,
      prompt:
        "Review the referral for any acute safety issues such as chest pain at rest, angina symptoms with hemodynamic instability, severe shortness of breath, syncope, stroke-like symptoms, active suicidal ideation, or any other emergency red flag. If any acute safety issue is present, immediately use the sendSms tool to send a short alert message to 555-555-5555. Include the patient name, referral reference, and the specific safety concern. If there is no clear acute safety issue, do nothing.",
    },
    {
      matchName: "Inbound PDF Vitals Review",
      name: "Inbound PDF Vitals Review",
      triggeringEvent: "request_received",
      enabledTools: ["summarizeAttachments", "comment"],
      active: true,
      prompt:
        "If the referral includes inbound PDF attachments, review them using summarizeAttachments. Extract any relevant key vitals you can find, such as blood pressure, heart rate, oxygen saturation, weight, BMI, and recent lab values if present. Then use the comment tool to add a concise note summarizing the important vitals and where they were found. If there are no PDF attachments, do nothing.",
    },
    {
      matchName: "Redirect Angina Referrals To Chest Pain Clinic",
      name: "Redirect Angina Referrals To Chest Pain Clinic",
      triggeringEvent: "request_received",
      enabledTools: ["forward"],
      active: true,
      prompt:
        "Check the referral details for angina-like symptoms, including exertional chest pain, pressure, tightness, pain radiating to the arm or jaw, or chest discomfort relieved by rest or nitroglycerin. If the presentation is consistent with possible angina, forward the referral to the Chest Pain Clinic listing. Otherwise do nothing.",
    },
    {
      matchName: "Add Concise Triage Comment",
      name: "Add Concise Triage Comment",
      triggeringEvent: "request_received",
      enabledTools: ["comment"],
      active: true,
      prompt:
        "Summarize the inbound referral in one concise triage comment. Include the reason for referral, key red flags or relevant negatives, and the most useful next-triage detail in two or three short sentences. Use the comment tool to record the summary.",
    },
    {
      matchName: "Redirect M2L Postal Code Referrals To SHSC",
      name: "Redirect M2L Postal Code Referrals To SHSC",
      triggeringEvent: "request_received",
      enabledTools: ["forward"],
      active: true,
      prompt:
        "Look up the patient's postal code. If the first three characters are M2L, forward the referral to the SHSC listing. If the postal code is anything else or unavailable, do nothing.",
    },
  ];

  const repository = cxt.getRoutingRulesRepository();
  for (const rule of rules) {
    const existing = existingRules.find((item) => item.name === rule.matchName);

    if (existing) {
      await repository.update({
        id: existing.id,
        name: rule.name,
        triggeringEvent: rule.triggeringEvent,
        prompt: rule.prompt,
        active: rule.active,
        enabledTools: rule.enabledTools as RoutingToolName[],
      });
      logger.info(`Updated rule: ${rule.name}`);
    } else {
      await repository.create({
        name: rule.name,
        triggeringEvent: rule.triggeringEvent,
        prompt: rule.prompt,
        active: rule.active,
        enabledTools: rule.enabledTools as RoutingToolName[],
      });
      logger.info(`Created rule: ${rule.name}`);
    }
  }

  return rules.length;
}

function buildRequestSeeds(): RequestSeed[] {
  return [
    {
      identifier: "Seed - Angina Referral",
      patientGivenName: "Amira",
      patientFamilyName: "Rahman",
      patientBirthDate: "1968-02-15",
      patientGender: "female",
      patientPostalCode: "M4C 1A1",
      patientPhone: "416-555-0101",
      patientEmail: "amira.rahman@example.com",
      patientHealthNumber: "9432123456",
      patientMedicalRecordNumber: "MRN-1001",
      referrerGivenName: "Priya",
      referrerFamilyName: "Shah",
      requestedListingTitle: "General Cardiology Intake",
      requestedListingRef: "GENCARDIOLOGY",
      healthServiceCategory: "Cardiology",
      referralSummary:
        "59-year-old with a three-week history of exertional substernal chest pressure radiating to the left arm, relieved by rest after five minutes. Occasional diaphoresis with stairs. Please assess for stable angina and determine urgency.",
      receivedAt: "2026-03-14T10:30:00.000Z",
      referralRef: "SEED-ANGINA-001",
      sourceMessageId: "seed-message-angina-001",
      includeSampleBundle: true,
      includeRawBundle: true,
    },
    {
      identifier: "Seed - Inbound PDF Vitals Referral",
      patientGivenName: "Leon",
      patientFamilyName: "Martel",
      patientBirthDate: "1959-07-29",
      patientGender: "male",
      patientPostalCode: "M5V 2T6",
      patientPhone: "416-555-0112",
      patientHealthNumber: "9432123477",
      patientMedicalRecordNumber: "MRN-1002",
      referrerGivenName: "Elena",
      referrerFamilyName: "Brooks",
      requestedListingTitle: "General Internal Medicine",
      requestedListingRef: "GENMEDICINE",
      healthServiceCategory: "Internal Medicine",
      referralSummary:
        "Please review attached consultation note and recent vitals for a 66-year-old with fatigue, edema, and worsening blood pressure control. The PDF includes the latest office measurements and medication list.",
      receivedAt: "2026-03-15T13:00:00.000Z",
      referralRef: "SEED-PDF-001",
      sourceMessageId: "seed-message-pdf-001",
      includeSampleBundle: true,
      includeRawBundle: true,
      bundleAttachments: [
        {
          title: "office-note-vitals.pdf",
          description:
            "Office note PDF with vitals: BP 168/96, HR 92, SpO2 97%, weight 92 kg, creatinine 131.",
          url: "https://example.com/mock/office-note-vitals.pdf",
        },
      ],
      archivedBlobs: [
        {
          filename: "referral-letter-vitals.pdf",
          kind: "primary_pdf",
          summary:
            "Referral letter notes worsening edema, office blood pressure of 168 over 96, heart rate 92, and a request to review recent medication changes.",
        },
      ],
    },
    {
      identifier: "Seed - M2L Postal Code Referral",
      patientGivenName: "Noah",
      patientFamilyName: "Greenberg",
      patientBirthDate: "1976-11-03",
      patientGender: "male",
      patientPostalCode: "M2L 1V7",
      patientPhone: "416-555-0155",
      patientHealthNumber: "9432123499",
      patientMedicalRecordNumber: "MRN-1003",
      referrerGivenName: "Dana",
      referrerFamilyName: "Liu",
      requestedListingTitle: "General Internal Medicine",
      requestedListingRef: "GENMEDICINE",
      healthServiceCategory: "General Medicine",
      referralSummary:
        "48-year-old with intermittent dizziness and poorly controlled hypertension. Lives in the M2L catchment area and needs local triage.",
      receivedAt: "2026-03-16T08:45:00.000Z",
      referralRef: "SEED-M2L-001",
      sourceMessageId: "seed-message-m2l-001",
      includeSampleBundle: true,
      includeRawBundle: true,
    },
    {
      identifier: "Seed - Acute Safety Referral",
      patientGivenName: "Janelle",
      patientFamilyName: "Parker",
      patientBirthDate: "1985-04-22",
      patientGender: "female",
      patientPostalCode: "M3H 4K2",
      patientPhone: "416-555-0188",
      patientHealthNumber: "9432123511",
      patientMedicalRecordNumber: "MRN-1004",
      referrerGivenName: "Marcus",
      referrerFamilyName: "Osei",
      requestedListingTitle: "General Cardiology Intake",
      requestedListingRef: "GENCARDIOLOGY",
      healthServiceCategory: "Cardiology",
      referralSummary:
        "Urgent referral for recurrent chest pain now occurring at rest with associated shortness of breath and one syncopal episode yesterday. Please review immediately due to concern for acute coronary syndrome.",
      receivedAt: "2026-03-16T15:20:00.000Z",
      referralRef: "SEED-SAFETY-001",
      sourceMessageId: "seed-message-safety-001",
      includeSampleBundle: true,
      includeRawBundle: true,
      archivedBlobs: [
        {
          filename: "urgent-referral-letter.pdf",
          kind: "primary_pdf",
          summary:
            "Urgent cardiology referral documenting chest pain at rest, dyspnea, and a syncopal episode from the prior day with recommendation for immediate review.",
        },
      ],
    },
    {
      identifier: "Seed - Headache Referral",
      patientGivenName: "Sonia",
      patientFamilyName: "Patel",
      patientBirthDate: "1991-05-30",
      patientGender: "female",
      patientPostalCode: "M6G 2R7",
      patientHealthNumber: "9432123522",
      patientMedicalRecordNumber: "MRN-1005",
      referrerGivenName: "Aaron",
      referrerFamilyName: "Nguyen",
      requestedListingTitle: "Neurology Rapid Access",
      requestedListingRef: "NEURORAPID",
      healthServiceCategory: "Neurology",
      referralSummary:
        "34-year-old with new migraine pattern and transient visual aura, no focal weakness, seeking rapid-access neurology review.",
      receivedAt: "2026-03-10T09:15:00.000Z",
      referralRef: "SEED-NEURO-001",
      sourceMessageId: "seed-message-neuro-001",
    },
    {
      identifier: "Seed - Anemia GI Referral",
      patientGivenName: "Walter",
      patientFamilyName: "Kim",
      patientBirthDate: "1954-01-09",
      patientGender: "male",
      patientPostalCode: "L4J 3B1",
      patientHealthNumber: "9432123533",
      patientMedicalRecordNumber: "MRN-1006",
      referrerGivenName: "Selina",
      referrerFamilyName: "Morgan",
      requestedListingTitle: "Gastroenterology Intake",
      requestedListingRef: "GIINTAKE",
      healthServiceCategory: "Gastroenterology",
      referralSummary:
        "72-year-old with iron deficiency anemia, positive FIT, and mild fatigue. Referral requests endoscopy triage.",
      receivedAt: "2026-03-10T11:05:00.000Z",
      referralRef: "SEED-GI-001",
      sourceMessageId: "seed-message-gi-001",
      archivedBlobs: [
        {
          filename: "anemia-referral-letter.pdf",
          kind: "primary_pdf",
          summary:
            "Referral letter describes positive FIT, hemoglobin 93, ferritin 8, and a request for urgent endoscopy planning.",
        },
      ],
    },
    {
      identifier: "Seed - Palpitations Referral",
      patientGivenName: "Carla",
      patientFamilyName: "Diaz",
      patientBirthDate: "1982-08-21",
      patientGender: "female",
      patientPostalCode: "M1R 3N2",
      patientHealthNumber: "9432123544",
      patientMedicalRecordNumber: "MRN-1007",
      referrerGivenName: "Tim",
      referrerFamilyName: "Edwards",
      requestedListingTitle: "General Cardiology Intake",
      requestedListingRef: "GENCARDIOLOGY",
      healthServiceCategory: "Cardiology",
      referralSummary:
        "43-year-old with intermittent palpitations, smartwatch-detected tachycardia, no syncope, requesting cardiology assessment and Holter guidance.",
      receivedAt: "2026-03-11T08:20:00.000Z",
      referralRef: "SEED-CARDIO-002",
      sourceMessageId: "seed-message-cardio-002",
    },
    {
      identifier: "Seed - Memory Clinic Referral",
      patientGivenName: "Elaine",
      patientFamilyName: "Wong",
      patientBirthDate: "1949-12-17",
      patientGender: "female",
      patientPostalCode: "M2N 7C8",
      patientHealthNumber: "9432123555",
      patientMedicalRecordNumber: "MRN-1008",
      referrerGivenName: "Farid",
      referrerFamilyName: "Khan",
      requestedListingTitle: "General Internal Medicine",
      requestedListingRef: "GENMEDICINE",
      healthServiceCategory: "Geriatrics",
      referralSummary:
        "76-year-old with progressive memory decline over 18 months, preserved function for basic ADLs, requesting initial triage and workup guidance.",
      receivedAt: "2026-03-11T14:55:00.000Z",
      referralRef: "SEED-GERI-001",
      sourceMessageId: "seed-message-geri-001",
    },
    {
      identifier: "Seed - Neuropathy Referral",
      patientGivenName: "Harpreet",
      patientFamilyName: "Gill",
      patientBirthDate: "1963-04-11",
      patientGender: "male",
      patientPostalCode: "M9A 5K6",
      patientHealthNumber: "9432123566",
      patientMedicalRecordNumber: "MRN-1009",
      referrerGivenName: "Leah",
      referrerFamilyName: "Johnson",
      requestedListingTitle: "Neurology Rapid Access",
      requestedListingRef: "NEURORAPID",
      healthServiceCategory: "Neurology",
      referralSummary:
        "61-year-old with progressive stocking-glove numbness, gait imbalance, and diabetes history. Requesting neuropathy assessment.",
      receivedAt: "2026-03-12T10:05:00.000Z",
      referralRef: "SEED-NEURO-002",
      sourceMessageId: "seed-message-neuro-002",
    },
    {
      identifier: "Seed - Reflux Referral",
      patientGivenName: "Megan",
      patientFamilyName: "Price",
      patientBirthDate: "1974-06-08",
      patientGender: "female",
      patientPostalCode: "M8V 1L4",
      patientHealthNumber: "9432123577",
      patientMedicalRecordNumber: "MRN-1010",
      referrerGivenName: "Omar",
      referrerFamilyName: "Siddiqui",
      requestedListingTitle: "Gastroenterology Intake",
      requestedListingRef: "GIINTAKE",
      healthServiceCategory: "Gastroenterology",
      referralSummary:
        "50-year-old with refractory reflux despite PPI therapy, nocturnal symptoms, and intermittent dysphagia. Seeking specialist opinion.",
      receivedAt: "2026-03-12T12:25:00.000Z",
      referralRef: "SEED-GI-002",
      sourceMessageId: "seed-message-gi-002",
    },
    {
      identifier: "Seed - Syncope Referral",
      patientGivenName: "Brandon",
      patientFamilyName: "Reid",
      patientBirthDate: "1970-09-02",
      patientGender: "male",
      patientPostalCode: "L6A 4W1",
      patientHealthNumber: "9432123588",
      patientMedicalRecordNumber: "MRN-1011",
      referrerGivenName: "Julia",
      referrerFamilyName: "Tran",
      requestedListingTitle: "General Cardiology Intake",
      requestedListingRef: "GENCARDIOLOGY",
      healthServiceCategory: "Cardiology",
      referralSummary:
        "55-year-old with two unexplained syncopal episodes over the last month, no chest pain, normal initial ECG, requesting expedited cardiology review.",
      receivedAt: "2026-03-12T16:40:00.000Z",
      referralRef: "SEED-CARDIO-003",
      sourceMessageId: "seed-message-cardio-003",
    },
    {
      identifier: "Seed - IBS Referral",
      patientGivenName: "Rina",
      patientFamilyName: "Sarkar",
      patientBirthDate: "1988-03-14",
      patientGender: "female",
      patientPostalCode: "M6H 3P9",
      patientHealthNumber: "9432123599",
      patientMedicalRecordNumber: "MRN-1012",
      referrerGivenName: "Paul",
      referrerFamilyName: "Miller",
      requestedListingTitle: "Gastroenterology Intake",
      requestedListingRef: "GIINTAKE",
      healthServiceCategory: "Gastroenterology",
      referralSummary:
        "37-year-old with alternating constipation and diarrhea, bloating, normal calprotectin, and persistent symptoms despite dietary modification.",
      receivedAt: "2026-03-13T09:50:00.000Z",
      referralRef: "SEED-GI-003",
      sourceMessageId: "seed-message-gi-003",
    },
    {
      identifier: "Seed - Tremor Referral",
      patientGivenName: "Peter",
      patientFamilyName: "Vella",
      patientBirthDate: "1960-02-19",
      patientGender: "male",
      patientPostalCode: "M4S 2E3",
      patientHealthNumber: "9432123601",
      patientMedicalRecordNumber: "MRN-1013",
      referrerGivenName: "Nadia",
      referrerFamilyName: "Arora",
      requestedListingTitle: "Neurology Rapid Access",
      requestedListingRef: "NEURORAPID",
      healthServiceCategory: "Neurology",
      referralSummary:
        "65-year-old with progressive right-hand tremor and bradykinesia over one year, requesting movement disorder triage.",
      receivedAt: "2026-03-13T11:30:00.000Z",
      referralRef: "SEED-NEURO-003",
      sourceMessageId: "seed-message-neuro-003",
      archivedBlobs: [
        {
          filename: "neurology-referral-letter.pdf",
          kind: "primary_pdf",
          summary:
            "Letter documents unilateral resting tremor, reduced arm swing, and progressive slowness affecting handwriting over twelve months.",
        },
      ],
    },
    {
      identifier: "Seed - Abdominal Pain Referral",
      patientGivenName: "Dalia",
      patientFamilyName: "Ibrahim",
      patientBirthDate: "1996-10-24",
      patientGender: "female",
      patientPostalCode: "M5B 1Y5",
      patientHealthNumber: "9432123612",
      patientMedicalRecordNumber: "MRN-1014",
      referrerGivenName: "Victor",
      referrerFamilyName: "Lam",
      requestedListingTitle: "General Internal Medicine",
      requestedListingRef: "GENMEDICINE",
      healthServiceCategory: "Internal Medicine",
      referralSummary:
        "29-year-old with chronic intermittent right upper quadrant pain, normal ultrasound, and mild transaminitis. Requesting internist review.",
      receivedAt: "2026-03-13T15:15:00.000Z",
      referralRef: "SEED-IM-001",
      sourceMessageId: "seed-message-im-001",
    },
    {
      identifier: "Seed - M2L Follow-up Referral",
      patientGivenName: "George",
      patientFamilyName: "Haddad",
      patientBirthDate: "1957-07-01",
      patientGender: "male",
      patientPostalCode: "M2L 2B4",
      patientHealthNumber: "9432123623",
      patientMedicalRecordNumber: "MRN-1015",
      referrerGivenName: "Rachel",
      referrerFamilyName: "Stone",
      requestedListingTitle: "General Cardiology Intake",
      requestedListingRef: "GENCARDIOLOGY",
      healthServiceCategory: "Cardiology",
      referralSummary:
        "68-year-old in the M2L region with exertional dyspnea and lower extremity edema, requesting local cardiology triage.",
      receivedAt: "2026-03-14T09:05:00.000Z",
      referralRef: "SEED-M2L-002",
      sourceMessageId: "seed-message-m2l-002",
    },
    {
      identifier: "Seed - Sleepiness Referral",
      patientGivenName: "Tara",
      patientFamilyName: "Lopez",
      patientBirthDate: "1987-01-28",
      patientGender: "female",
      patientPostalCode: "M3C 1H8",
      patientHealthNumber: "9432123634",
      patientMedicalRecordNumber: "MRN-1016",
      referrerGivenName: "Greg",
      referrerFamilyName: "Chan",
      requestedListingTitle: "General Internal Medicine",
      requestedListingRef: "GENMEDICINE",
      healthServiceCategory: "Sleep Medicine",
      referralSummary:
        "38-year-old with daytime somnolence, witnessed apneas, and elevated BMI. Requesting consult for sleep-disordered breathing workup.",
      receivedAt: "2026-03-14T14:20:00.000Z",
      referralRef: "SEED-SLEEP-001",
      sourceMessageId: "seed-message-sleep-001",
    },
  ];
}

async function findExistingErequest(
  cxt: ApplicationContext,
  seed: RequestSeed,
  existingByReferralRef: Map<string, Erequest>
) {
  const byReferral = existingByReferralRef.get(seed.referralRef);
  if (byReferral) {
    return byReferral;
  }

  const byChecksum = await cxt
    .getErequestsRepository()
    .findByMessageChecksum(stableMessageChecksum(seed));
  if (byChecksum?.referralRef) {
    existingByReferralRef.set(byChecksum.referralRef, byChecksum);
  }
  return byChecksum;
}

function toUpdateErequest(id: string, record: NewErequest): UpdateErequest {
  return {
    id,
    sourceMessageId: record.sourceMessageId,
    messageChecksum: record.messageChecksum,
    referralRef: record.referralRef,
    triggeringEvent: record.triggeringEvent,
    receivedAt: record.receivedAt,
    patientHealthNumber: record.patientHealthNumber,
    patientMedicalRecordNumber: record.patientMedicalRecordNumber,
    patientName: record.patientName,
    patientFamilyName: record.patientFamilyName,
    patientGivenNames: record.patientGivenNames,
    patientDateOfBirth: record.patientDateOfBirth,
    referringProvider: record.referringProvider,
    receivingProvider: record.receivingProvider,
    requestedListingRef: record.requestedListingRef,
    requestedListingTitle: record.requestedListingTitle,
    healthServiceTypes: record.healthServiceTypes,
    requestedServiceDescription: record.requestedServiceDescription,
    rawBundle: record.rawBundle,
    primaryBlobId: record.primaryBlobId,
    storageStatus: record.storageStatus,
    ingestionError: record.ingestionError,
  };
}

async function seedArchivedBlobs(
  cxt: ApplicationContext,
  erequest: Erequest,
  seed: RequestSeed
) {
  if (!seed.archivedBlobs?.length) {
    if (erequest.primaryBlobId || erequest.storageStatus !== "stored") {
      await cxt.getErequestsRepository().update({
        id: erequest.id,
        primaryBlobId: null,
        storageStatus: "stored",
        ingestionError: null,
      });
    }
    return 0;
  }

  const blobStorage = cxt.getBlobStorageService();
  const existingBlobs = await cxt.getErequestsRepository().listBlobs(erequest.id);
  let createdCount = 0;
  let primaryBlobId = erequest.primaryBlobId ?? null;

  for (const blobSeed of seed.archivedBlobs) {
    const existing = existingBlobs.find(
      (blob) => blob.filename === blobSeed.filename && blob.kind === blobSeed.kind
    );
    if (existing) {
      if (!primaryBlobId && blobSeed.kind === "primary_pdf") {
        primaryBlobId = existing.id;
      }
      continue;
    }

    const content = createPlaceholderPdf(seed, blobSeed);
    const storageKey = blobStorage.buildStorageKey({
      tenantId: cxt.getNonEmptyTenantId(),
      erequestId: erequest.id,
      filename: blobSeed.filename,
      kind: blobSeed.kind,
    });
    const object = await blobStorage.putObject({
      key: storageKey,
      body: content,
      contentType: "application/pdf",
      metadata: {
        erequestId: erequest.id,
        referralRef: seed.referralRef,
      },
    });
    const createdBlob = await cxt.getErequestsRepository().createBlob({
      erequestId: erequest.id,
      kind: blobSeed.kind,
      filename: blobSeed.filename,
      contentType: "application/pdf",
      byteSize: object.byteSize,
      checksumSha256: checksum(content),
      storageProvider: blobStorage.getProvider(),
      storageBucket: object.storageBucket,
      storageKey: object.storageKey,
      sourceUrl: null,
      downloadStatus: "stored",
    });
    if (!primaryBlobId && blobSeed.kind === "primary_pdf") {
      primaryBlobId = createdBlob.id;
    }
    createdCount += 1;
  }

  await cxt.getErequestsRepository().update({
    id: erequest.id,
    primaryBlobId,
    storageStatus: "stored",
    ingestionError: null,
  });

  return createdCount;
}

async function main() {
  if (!process.env.DB_URL) {
    throw new Error("Missing DB_URL.");
  }

  const { tenantId, userId } = parseArgs();
  const cxt = new ApplicationContext(logger);
  cxt.setSession({
    user: {
      id: userId,
      name: "Seed Script",
      roles: { admin: "system" },
      activeTenantId: tenantId,
      tenantId,
      memberships: [],
    },
  });

  const healthcareServicesRepository = cxt.getHealthcareServicesRepository();
  const routingRulesRepository = cxt.getRoutingRulesRepository();
  const testServiceRequestsRepository = cxt.getTestServiceRequestsRepository();
  const erequestsRepository = cxt.getErequestsRepository();

  const [existingListings, existingRules, existingSamples, existingErequestPage] =
    await Promise.all([
      healthcareServicesRepository.getAllAtTenant(),
      routingRulesRepository.getAllAtTenant(),
      testServiceRequestsRepository.getAllAtTenant(),
      erequestsRepository.search({ page: 1, pageSize: 250 }),
    ]);

  const existingByReferralRef = new Map<string, Erequest>(
    existingErequestPage.items
      .filter((item) => item.referralRef)
      .map((item) => [item.referralRef!, item])
  );

  const listingCount = await seedListings(existingListings, cxt);
  const ruleCount = await seedRules(existingRules, cxt);
  const requestSeeds = buildRequestSeeds();

  let sampleBundleCount = 0;
  let erequestCount = 0;
  let blobCount = 0;

  for (const seed of requestSeeds) {
    const bundle = seed.includeSampleBundle || seed.includeRawBundle ? buildBundle(seed) : null;

    if (seed.includeSampleBundle && bundle) {
      const sampleRecord: NewTestServiceRequest = { content: bundle };
      const existingSample = existingSamples.find(
        (item) => item.content.identifier?.value === seed.identifier
      );

      if (existingSample) {
        await testServiceRequestsRepository.update({
          id: existingSample.id,
          content: bundle,
        });
        logger.info(`Updated sample data: ${seed.identifier}`);
      } else {
        await testServiceRequestsRepository.create(sampleRecord);
        logger.info(`Created sample data: ${seed.identifier}`);
      }
      sampleBundleCount += 1;
    }

    const erequestRecord = toNewErequest(seed, seed.includeRawBundle ? bundle : null);
    const existingErequest = await findExistingErequest(
      cxt,
      seed,
      existingByReferralRef
    );

    let persistedErequest: Erequest;
    if (existingErequest) {
      persistedErequest = await erequestsRepository.update(
        toUpdateErequest(existingErequest.id, erequestRecord)
      );
      existingByReferralRef.set(seed.referralRef, persistedErequest);
      logger.info(`Updated eRequest: ${seed.referralRef}`);
    } else {
      persistedErequest = await erequestsRepository.create(erequestRecord);
      existingByReferralRef.set(seed.referralRef, persistedErequest);
      logger.info(`Created eRequest: ${seed.referralRef}`);
    }
    erequestCount += 1;

    blobCount += await seedArchivedBlobs(cxt, persistedErequest, seed);
  }

  logger.info(
    `Seed complete for tenant ${tenantId}: ${listingCount} listings, ${ruleCount} rules, ${sampleBundleCount} sample bundles, ${erequestCount} archived eRequests, ${blobCount} new blobs.`
  );
}

main().catch((error) => {
  logger.error("Seed script failed.", error);
  process.exit(1);
});
