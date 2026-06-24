import { ApplicationContext } from "@/src/entities/models/application-context";
import type { HttpResponseInit } from "@/src/entities/models/http";
import type {
  Bundle,
  DocumentReference,
  MessageHeader,
  Practitioner,
  PractitionerRole,
  Resource,
  ServiceRequest,
} from "fhir/r4";
import { z } from "zod";
import { archiveErequestUseCase } from "@/src/application/use-cases/archive-erequest.use-case";
import { DocumentDownloadCache } from "@/src/infrastructure/services/document-download-cache";
import { processServiceRequestEventUseCase } from "@/src/application/use-cases/process-service-request-event.use-case";
import type { Attachment } from "@/src/entities/models/attachment";
import type { ServiceRequestEventContext } from "@/src/entities/models/service-request-event-context";

const inputSchema = z.object({
  method: z.string(),
  body: z
    .object({
      resourceType: z.literal("Bundle"),
    })
    .passthrough(),
});

export async function processMessageController(
  input: { method: string; body: unknown },
  cxt: ApplicationContext
): Promise<HttpResponseInit> {
  const { data, error: inputParseError } = inputSchema.safeParse(input);

  if (inputParseError) {
    return {
      status: 400,
      body: JSON.stringify({
        error: "invalid_request",
        error_description: "Invalid request",
      }),
    };
  }

  const bundle = data?.body as unknown as Bundle;
  const eventContext = await extractServiceRequestContextFromMessageBundle(bundle);
  if (eventContext instanceof Error) {
    return {
      status: 400,
      body: JSON.stringify({ error: eventContext.message }),
    };
  }
  if (eventContext.triggeringEvent === "request_updated") {
    return {
      body: JSON.stringify({
        message:
          "Service request event processed. Request_updated ignored to limit noise",
      }),
      status: 200,
    };
  }

  const downloadCache = new DocumentDownloadCache(cxt.getOceanClientService());

  const archivalResult = await archiveErequestUseCase(eventContext, cxt, downloadCache);
  eventContext.archivalMessage = archivalResult.message;
  eventContext.archivalError = archivalResult.error;

  await loadAttachmentsIfIndicated(eventContext, cxt, bundle, downloadCache);

  try {
    const result = await processServiceRequestEventUseCase(eventContext, cxt);
    cxt.logger.info(
      `Successfully processed service request event: ${eventContext.triggeringEvent}`,
      result
    );
    return {
      body: JSON.stringify({ message: result.message }),
      status: 200,
    };
  } catch (error: unknown) {
    cxt.logger.error(
      `Error processing service request event: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return {
      status: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

async function loadAttachmentsIfIndicated(
  eventContext: ServiceRequestEventContext,
  cxt: ApplicationContext,
  bundle: Bundle,
  downloadCache: DocumentDownloadCache
) {
  if (
    eventContext.triggeringEvent === "request_received" ||
    eventContext.triggeringEvent === "request_message"
  ) {
    if (process.env.FETCH_ATTACHMENTS === "false") {
      cxt.logger.info(
        `Skipping attachments loading (FETCH_ATTACHMENTS is false)`
      );
      return;
    }

    // Only fetch attachments when at least one active rule for this event type
    // has summarizeAttachments enabled — attachment binaries contain PHI and
    // should not be retrieved unless they will actually be used.
    const rules = await cxt.getRoutingRulesRepository().getAllAtTenant();
    const hasAttachmentRule = rules.some(
      (rule) =>
        rule.active &&
        rule.triggeringEvent === eventContext.triggeringEvent &&
        rule.enabledTools.includes("summarizeAttachments")
    );

    console.log("[loadAttachmentsIfIndicated] hasAttachmentRule:", hasAttachmentRule, "| event:", eventContext.triggeringEvent, "| rules checked:", rules.length);

    if (!hasAttachmentRule) {
      cxt.logger.info(
        `Skipping attachment fetch: no active rule with summarizeAttachments enabled for event ${eventContext.triggeringEvent}`
      );
      return;
    }

    cxt.logger.info(
      `Loading attachments for referral: ${
        eventContext.referralRef || "unknown"
      }`
    );
    eventContext.attachments = await loadAttachments(
      bundle,
      cxt,
      eventContext.referralRef,
      downloadCache
    );
  }
}

async function extractServiceRequestContextFromMessageBundle(
  bundle: Bundle
): Promise<ServiceRequestEventContext | Error> {
  try {
    const resources =
      (bundle.entry?.map((e) => e.resource).filter((r) => r) as Resource[]) ||
      [];
    const messageHeader = resources.find(
      (r) => r?.resourceType === "MessageHeader"
    ) as MessageHeader | undefined;
    if (!messageHeader) {
      return new Error(
        "Error: FHIR Bundle message header not found. Disregarding message."
      );
    }
    const senderReference = messageHeader.sender?.reference;
    const senderPractitionerRole = resources.find(
      (r) => r.resourceType === "PractitionerRole" && r.id === senderReference
    ) as PractitionerRole | undefined;
    const senderPractitioner = resources.find(
      (r) =>
        r.resourceType === "Practitioner" &&
        r.id === senderPractitionerRole?.practitioner?.reference
    ) as Practitioner | undefined;
    const senderPractitionerName = [
      senderPractitioner?.name?.[0]?.given?.[0],
      senderPractitioner?.name?.[0]?.family,
    ]
      .filter(Boolean)
      .join(" ");
    const fhirMessageEventType = messageHeader?.eventCoding?.code;
    const triggeringEvent =
      fhirMessageEventType === "add-service-request"
        ? "request_received"
        : "request_updated";
    const serviceRequest = resources.find(
      (r) => r.resourceType === "ServiceRequest"
    ) as ServiceRequest | undefined;

    const referralRef = serviceRequest?.identifier?.find((i) =>
      i.system?.includes("/id-ereferral-reference")
    )?.value;

    const receiverReference =
      messageHeader.destination?.[0]?.receiver?.reference;
    const destinationPractitionerRole = bundle.entry?.find(
      (e) =>
        e.resource?.resourceType === "PractitionerRole" &&
        e.fullUrl === receiverReference
    )?.resource as PractitionerRole | undefined;
    const requestedListingRef = destinationPractitionerRole?.identifier?.find(
      (i) => i.system?.includes("/id-referral-target-reference")
    )?.value;
    // const requestNote = serviceRequest?.note?.[0]?.text;
    // const requestedCategory = serviceRequest?.category?.map((c) => c.coding?.[0]?.code).join(", ");
    const destination = messageHeader.destination?.[0]?.name;
    const requestedServiceDescription = (
      (serviceRequest?.orderDetail
        ?.map((orderDetail) => orderDetail.coding?.[0]?.display)
        .join(", ") || "") +
      " → " +
      destination
    ).trim();

    return {
      serviceRequestBundle: bundle,
      triggeringEvent: triggeringEvent,
      referralRef: referralRef,
      requestingProvider: senderPractitionerName,
      requestedListingTitle: destination,
      requestedListingRef,
      requestedServiceDescription,
    };
  } catch (error) {
    return new Error(
      `Error extracting service request context from message bundle: ${error}`
    );
  }
}

async function loadAttachments(
  bundle: Bundle,
  cxt: ApplicationContext,
  referralRef: string | undefined,
  downloadCache: DocumentDownloadCache
): Promise<Attachment[]> {
  const documentReferences =
    bundle.entry
      ?.map((e) => e.resource)
      .filter(
        (r): r is DocumentReference => r?.resourceType === "DocumentReference"
      ) || [];

  if (documentReferences.length === 0) {
    return [];
  }

  const attachments: Attachment[] = [];

  for (const docRef of documentReferences) {
    const attachment = await processDocumentReference(
      docRef,
      cxt,
      referralRef,
      downloadCache
    );
    if (attachment) {
      attachments.push(attachment);
    }
  }

  return attachments;
}

async function processDocumentReference(
  documentReference: DocumentReference,
  cxt: ApplicationContext,
  referralRef: string | undefined,
  downloadCache: DocumentDownloadCache
): Promise<Attachment | undefined> {
  cxt.logger.info(
    `Processing document reference: ${documentReference.id} for referral: ${
      referralRef || "unknown"
    }`
  );
  const attachment = documentReference.content?.[0]?.attachment;
  if (!attachment) {
    cxt.logger.error("Attachment not found");
    return;
  }
  const title = attachment.title;
  if (!title) {
    cxt.logger.error("Attachment title not found");
    return;
  }
  const letterUrl = attachment.url;
  if (!letterUrl) {
    cxt.logger.error("Letter URL not found");
    return;
  }
  cxt.logger.info(
    `Fetching letter data for attachment ${attachment.title} for referral: ${
      referralRef || "unknown"
    }`
  );
  const blob = await downloadCache.fetchLetterData(letterUrl);
  return {
    title,
    contentType: attachment.contentType,
    data: blob,
  };
}
