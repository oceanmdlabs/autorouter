import { createHash } from "node:crypto";
import type {
  Bundle,
  Coding,
  DocumentReference,
  MessageHeader,
  Patient,
  Practitioner,
  PractitionerRole,
  Resource,
  ServiceRequest,
} from "fhir/r4";
import { ApplicationContext } from "@/src/entities/models/application-context";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";
import { DocumentDownloadCache } from "@/src/infrastructure/services/document-download-cache";

export type ArchiveErequestOutput = {
  archived: boolean;
  duplicate: boolean;
  erequestId?: string;
  message?: string;
  error?: string;
};

type DocumentToArchive = {
  kind: "primary_pdf" | "attachment";
  filename: string;
  contentType?: string;
  sourceUrl?: string;
};

export async function archiveErequestUseCase(
  eventContext: ServiceRequestEventContext,
  cxt: ApplicationContext,
  downloadCache?: DocumentDownloadCache,
): Promise<ArchiveErequestOutput> {
  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  if (!siteConfig?.erequestArchivalEnabled) {
    return { archived: false, duplicate: false };
  }

  const messageChecksum = sha256(
    JSON.stringify(eventContext.serviceRequestBundle),
  );
  const existing = await cxt
    .getErequestsRepository()
    .findByMessageChecksum(messageChecksum);
  if (existing) {
    return {
      archived: true,
      duplicate: true,
      erequestId: existing.id,
      message: `Duplicate delivery ignored for archival (${existing.id}).`,
    };
  }

  const erequest = await cxt.getErequestsRepository().create({
    ...extractErequestMetadata(eventContext.serviceRequestBundle, eventContext),
    messageChecksum,
    storageStatus: "pending",
  });

  const documents = collectDocuments(eventContext.serviceRequestBundle);
  if (documents.length === 0) {
    await cxt.getErequestsRepository().update({
      id: erequest.id,
      storageStatus: "partial_failure",
      ingestionError:
        "No downloadable documents were present in the inbound bundle.",
    });
    return {
      archived: true,
      duplicate: false,
      erequestId: erequest.id,
      error: "No downloadable documents were present in the inbound bundle.",
    };
  }

  let primaryBlobId: string | null = null;
  const failures: string[] = [];

  const cache = downloadCache ?? new DocumentDownloadCache(cxt.getOceanClientService());

  try {
    await cache.fetchCredentials();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load Ocean credentials";
    await cxt.getErequestsRepository().update({
      id: erequest.id,
      storageStatus: "failed",
      ingestionError: message,
    });
    return {
      archived: true,
      duplicate: false,
      erequestId: erequest.id,
      error: message,
    };
  }

  const blobStorage = cxt.getBlobStorageService();

  for (const document of documents) {
    if (!document.sourceUrl) {
      failures.push(`${document.filename}: missing source URL`);
      continue;
    }

    try {
      const data = await cache.fetchLetterData(document.sourceUrl);
      const storageKey = blobStorage.buildStorageKey({
        tenantId: cxt.getNonEmptyTenantId(),
        erequestId: erequest.id,
        filename: document.filename,
        kind: document.kind,
      });
      const object = await blobStorage.putObject({
        key: storageKey,
        body: data,
        contentType: document.contentType,
        metadata: {
          erequestId: erequest.id,
          referralRef: eventContext.referralRef ?? "",
        },
      });
      const blob = await cxt.getErequestsRepository().createBlob({
        erequestId: erequest.id,
        kind: document.kind,
        filename: document.filename,
        contentType: document.contentType,
        byteSize: object.byteSize,
        checksumSha256: sha256(data),
        storageProvider: "s3",
        storageBucket: object.storageBucket,
        storageKey: object.storageKey,
        sourceUrl: document.sourceUrl,
        downloadStatus: "stored",
      });
      if (!primaryBlobId && document.kind === "primary_pdf") {
        primaryBlobId = blob.id;
      }
    } catch (error) {
      failures.push(
        `${document.filename}: ${
          error instanceof Error ? error.message : "Unknown archival error"
        }`,
      );
    }
  }

  await cxt.getErequestsRepository().update({
    id: erequest.id,
    primaryBlobId,
    storageStatus:
      failures.length === 0
        ? "stored"
        : failures.length === documents.length
          ? "failed"
          : "partial_failure",
    ingestionError: failures.length ? failures.join("\n") : null,
  });

  return {
    archived: true,
    duplicate: false,
    erequestId: erequest.id,
    message:
      failures.length === 0
        ? `Archived eRequest ${erequest.id}.`
        : `Archived eRequest ${erequest.id} with ${failures.length} document failure(s).`,
    error: failures.length ? failures.join("\n") : undefined,
  };
}

function extractErequestMetadata(
  bundle: Bundle,
  eventContext: ServiceRequestEventContext,
) {
  const resources =
    (bundle.entry
      ?.map((entry) => {
        if (!entry.resource) return undefined;
        if (!entry.resource.id && entry.fullUrl) {
          return { ...entry.resource, id: entry.fullUrl };
        }
        return entry.resource;
      })
      .filter(Boolean) as Resource[]) ?? [];
  const serviceRequest = resources.find(
    (resource): resource is ServiceRequest =>
      resource.resourceType === "ServiceRequest",
  );
  const patient = resolvePatient(resources, serviceRequest);
  const messageHeader = resources.find(
    (resource): resource is MessageHeader =>
      resource.resourceType === "MessageHeader",
  );

  return {
    sourceMessageId: messageHeader?.id ?? null,
    referralRef: eventContext.referralRef ?? null,
    triggeringEvent: eventContext.triggeringEvent,
    receivedAt: new Date(),
    patientHealthNumber:
      findIdentifierValue(
        patient?.identifier,
        /health[ -]number|health card|hcn|hin/i,
      ) ?? null,
    patientMedicalRecordNumber:
      findIdentifierValue(patient?.identifier, /medical record|mrn|chart/i) ??
      null,
    patientName: formatPatientName(patient),
    patientFamilyName: patient?.name?.[0]?.family ?? null,
    patientGivenNames: patient?.name?.[0]?.given?.join(" ") ?? null,
    patientDateOfBirth: patient?.birthDate ? new Date(patient.birthDate) : null,
    referringProvider:
      eventContext.requestingProvider ??
      resolveSenderPractitioner(resources, messageHeader),
    receivingProvider: resolveReceivingProvider(resources, messageHeader),
    requestedListingRef: eventContext.requestedListingRef ?? null,
    requestedListingTitle: eventContext.requestedListingTitle ?? null,
    healthServiceTypes:
      serviceRequest?.category
        ?.flatMap((category) => category.coding ?? [])
        .map((coding) => coding.display || coding.code)
        .filter((value): value is string => Boolean(value)) ?? [],
    requestedServiceDescription:
      eventContext.requestedServiceDescription ?? null,
    rawBundle: bundle,
  };
}

function collectDocuments(bundle: Bundle) {
  const documents =
    bundle.entry
      ?.map((entry) => entry.resource)
      .filter(
        (resource): resource is DocumentReference =>
          resource?.resourceType === "DocumentReference",
      ) ?? [];

  return documents.flatMap((document, index) => {
    const attachment = document.content?.[0]?.attachment;
    if (!attachment?.url) {
      return [];
    }
    const kind = index === 0 ? "primary_pdf" : "attachment";
    return [
      {
        kind,
        filename: getDocumentFilename(document, index),
        contentType: attachment.contentType ?? "application/pdf",
        sourceUrl: attachment.url,
      } satisfies DocumentToArchive,
    ];
  });
}

function getDocumentFilename(document: DocumentReference, index: number) {
  const attachment = document.content?.[0]?.attachment;
  const title =
    attachment?.title?.trim() ||
    document.description?.trim() ||
    `document-${index + 1}`;
  const extension = attachment?.contentType === "application/pdf" ? ".pdf" : "";
  return extension && !title.toLowerCase().endsWith(extension)
    ? `${title}${extension}`
    : title;
}

function resolvePatient(
  resources: Resource[],
  serviceRequest?: ServiceRequest,
) {
  const patientReference = serviceRequest?.subject?.reference?.replace(
    /^#/,
    "",
  );
  return resources.find(
    (resource): resource is Patient =>
      resource.resourceType === "Patient" &&
      (resource.id === patientReference ||
        `Patient/${resource.id}` === serviceRequest?.subject?.reference),
  );
}

function resolveSenderPractitioner(
  resources: Resource[],
  messageHeader?: MessageHeader,
) {
  const senderReference = messageHeader?.sender?.reference;
  if (!senderReference) {
    return null;
  }
  const senderRole = resources.find(
    (resource): resource is PractitionerRole =>
      resource.resourceType === "PractitionerRole" &&
      (`PractitionerRole/${resource.id}` === senderReference ||
        resource.id === senderReference),
  );
  const practitionerReference = senderRole?.practitioner?.reference;
  const practitioner = resources.find(
    (resource): resource is Practitioner =>
      resource.resourceType === "Practitioner" &&
      (`Practitioner/${resource.id}` === practitionerReference ||
        resource.id === practitionerReference),
  );
  return practitioner ? formatPractitionerName(practitioner) : null;
}

function resolveReceivingProvider(
  resources: Resource[],
  messageHeader?: MessageHeader,
) {
  const receiverReference =
    messageHeader?.destination?.[0]?.receiver?.reference;
  const receiverRole = resources.find(
    (resource): resource is PractitionerRole =>
      resource.resourceType === "PractitionerRole" &&
      (`PractitionerRole/${resource.id}` === receiverReference ||
        resource.id === receiverReference),
  );
  if (messageHeader?.destination?.[0]?.name) {
    return messageHeader.destination[0].name;
  }
  if (receiverRole?.organization?.display) {
    return receiverRole.organization.display;
  }
  const practitionerReference = receiverRole?.practitioner?.reference;
  const practitioner = resources.find(
    (resource): resource is Practitioner =>
      resource.resourceType === "Practitioner" &&
      (`Practitioner/${resource.id}` === practitionerReference ||
        resource.id === practitionerReference),
  );
  return practitioner ? formatPractitionerName(practitioner) : null;
}

function findIdentifierValue(
  identifiers: Patient["identifier"] | undefined,
  pattern: RegExp,
) {
  return identifiers?.find((identifier) =>
    [
      identifier.system,
      identifier.type?.text,
      ...(identifier.type?.coding?.map(codingSummary) ?? []),
    ]
      .filter(Boolean)
      .some((value) => pattern.test(value!)),
  )?.value;
}

function codingSummary(coding: Coding) {
  return [coding.code, coding.display, coding.system].filter(Boolean).join(" ");
}

function formatPatientName(patient?: Patient) {
  const name = patient?.name?.[0];
  return name
    ? [...(name.given ?? []), name.family].filter(Boolean).join(" ")
    : null;
}

function formatPractitionerName(practitioner: Practitioner) {
  const name = practitioner.name?.[0];
  return [...(name?.given ?? []), name?.family].filter(Boolean).join(" ");
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
