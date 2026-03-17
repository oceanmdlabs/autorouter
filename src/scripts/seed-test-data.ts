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
import type { NewHealthcareService } from "@/src/entities/models/healthcare-service";
import type { NewRoutingRule } from "@/src/entities/models/routing-rule";
import type { NewTestServiceRequest } from "@/src/entities/models/test-service-request";
import type { NewErequest } from "@/src/entities/models/erequest";
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

type SampleRequestSeed = {
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
  attachments?: Array<{
    title: string;
    description: string;
    url: string;
  }>;
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
      continue;
    }
  }

  if (!tenantId) {
    throw new Error(
      "Missing tenant id. Pass --tenant-id <tenant-id> or set SEED_TENANT_ID."
    );
  }

  return { tenantId, userId };
}

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildBundle(seed: SampleRequestSeed): Bundle {
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
      seed.attachments?.map((_, index) => ({
        reference: `DocumentReference/document-${index + 1}`,
      })) ?? [],
  };

  const documents: DocumentReference[] =
    seed.attachments?.map((attachment, index) => ({
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

function toNewErequest(seed: SampleRequestSeed, bundle: Bundle): NewErequest {
  return {
    sourceMessageId: seed.sourceMessageId,
    messageChecksum: checksum(
      `${seed.identifier}:${JSON.stringify(bundle)}:${seed.sourceMessageId}`
    ),
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
    storageStatus: "stored",
    ingestionError: null,
  };
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
  ];

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

  const samples: SampleRequestSeed[] = [
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
        "Please review attached consultation note and recent vitals for an 66-year-old with fatigue, edema, and worsening blood pressure control. The PDF includes the latest office measurements and medication list.",
      receivedAt: "2026-03-15T13:00:00.000Z",
      referralRef: "SEED-PDF-001",
      sourceMessageId: "seed-message-pdf-001",
      attachments: [
        {
          title: "office-note-vitals.pdf",
          description:
            "Office note PDF with vitals: BP 168/96, HR 92, SpO2 97%, weight 92 kg, creatinine 131.",
          url: "https://example.com/mock/office-note-vitals.pdf",
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
    },
  ];

  const healthcareServicesRepository = cxt.getHealthcareServicesRepository();
  const routingRulesRepository = cxt.getRoutingRulesRepository();
  const testServiceRequestsRepository = cxt.getTestServiceRequestsRepository();
  const erequestsRepository = cxt.getErequestsRepository();

  const existingListings = await healthcareServicesRepository.getAllAtTenant();
  const existingRules = await routingRulesRepository.getAllAtTenant();
  const existingSamples = await testServiceRequestsRepository.getAllAtTenant();

  for (const listing of listings) {
    const existing = existingListings.find(
      (item) =>
        item.oceanReference === listing.oceanReference || item.name === listing.name
    );

    if (existing) {
      await healthcareServicesRepository.update({
        id: existing.id,
        name: listing.name,
        description: listing.description,
        oceanReference: listing.oceanReference,
      });
      logger.info(`Updated listing: ${listing.name}`);
      continue;
    }

    await healthcareServicesRepository.create(listing);
    logger.info(`Created listing: ${listing.name}`);
  }

  for (const rule of rules) {
    const existing = existingRules.find((item) => item.name === rule.matchName);

    if (existing) {
      await routingRulesRepository.update({
        id: existing.id,
        name: rule.name,
        triggeringEvent: rule.triggeringEvent,
        prompt: rule.prompt,
        active: rule.active,
        enabledTools: rule.enabledTools as RoutingToolName[],
      });
      logger.info(`Updated rule: ${rule.name}`);
      continue;
    }

    await routingRulesRepository.create({
      name: rule.name,
      triggeringEvent: rule.triggeringEvent,
      prompt: rule.prompt,
      active: rule.active,
      enabledTools: rule.enabledTools as RoutingToolName[],
    });
    logger.info(`Created rule: ${rule.name}`);
  }

  for (const sample of samples) {
    const bundle = buildBundle(sample);
    const sampleRecord: NewTestServiceRequest = {
      content: bundle,
    };
    const existingSample = existingSamples.find(
      (item) => item.content.identifier?.value === sample.identifier
    );

    if (existingSample) {
      await testServiceRequestsRepository.update({
        id: existingSample.id,
        content: bundle,
      });
      logger.info(`Updated sample data: ${sample.identifier}`);
    } else {
      await testServiceRequestsRepository.create(sampleRecord);
      logger.info(`Created sample data: ${sample.identifier}`);
    }

    const erequestRecord = toNewErequest(sample, bundle);
    const existingErequest = await erequestsRepository.findByMessageChecksum(
      erequestRecord.messageChecksum
    );

    if (existingErequest) {
      await erequestsRepository.update({
        id: existingErequest.id,
        sourceMessageId: erequestRecord.sourceMessageId,
        messageChecksum: erequestRecord.messageChecksum,
        referralRef: erequestRecord.referralRef,
        triggeringEvent: erequestRecord.triggeringEvent,
        receivedAt: erequestRecord.receivedAt,
        patientHealthNumber: erequestRecord.patientHealthNumber,
        patientMedicalRecordNumber: erequestRecord.patientMedicalRecordNumber,
        patientName: erequestRecord.patientName,
        patientFamilyName: erequestRecord.patientFamilyName,
        patientGivenNames: erequestRecord.patientGivenNames,
        patientDateOfBirth: erequestRecord.patientDateOfBirth,
        referringProvider: erequestRecord.referringProvider,
        receivingProvider: erequestRecord.receivingProvider,
        requestedListingRef: erequestRecord.requestedListingRef,
        requestedListingTitle: erequestRecord.requestedListingTitle,
        healthServiceTypes: erequestRecord.healthServiceTypes,
        requestedServiceDescription: erequestRecord.requestedServiceDescription,
        rawBundle: erequestRecord.rawBundle,
        primaryBlobId: erequestRecord.primaryBlobId,
        storageStatus: erequestRecord.storageStatus,
        ingestionError: erequestRecord.ingestionError,
      });
      logger.info(`Updated eRequest: ${sample.referralRef}`);
      continue;
    }

    await erequestsRepository.create(erequestRecord);
    logger.info(`Created eRequest: ${sample.referralRef}`);
  }

  logger.info(
    `Seed complete for tenant ${tenantId}: ${listings.length} listings, ${rules.length} rules, ${samples.length} sample bundles, ${samples.length} archived eRequests.`
  );
}

main().catch((error) => {
  logger.error("Seed script failed.", error);
  process.exit(1);
});
