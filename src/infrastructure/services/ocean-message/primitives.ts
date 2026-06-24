import type {
  Bundle,
  Communication,
  FhirResource,
  Identifier,
  MessageHeader,
  PractitionerRole,
  Reference,
  ServiceRequest,
  Task,
} from "fhir/r4";
import {
  getDeployUrl,
  getSourceEndpoint,
} from "@/src/application/services/ocean-server.utils";
import { InvalidArgumentsError, IOError } from "@/src/entities/errors/common";
import { uuid } from "@/src/entities/models/uuid";

export type EReferralEventV11 =
  | "notify-add-process-request"
  | "notify-add-appointment"
  | "notify-update-process-request"
  | "send-communication-from-provider"
  | "send-communication-from-requester"
  | "send-communication"
  | "notify-data-correction";

export type TaskCodeV11 =
  | "request-for-information-for-requester"
  | "process-request"
  | "process-request-consult";

export type TaskStatus =
  | "draft"
  | "requested"
  | "received"
  | "accepted"
  | "rejected"
  | "ready"
  | "cancelled"
  | "in-progress"
  | "on-hold"
  | "failed"
  | "completed"
  | "entered-in-error";

export const OCEAN_SERVER_URL = "https://ocean.cognisantmd.com";
export const OCEAN_REFERRAL_IDENTIFIER_SYSTEM = `${OCEAN_SERVER_URL}/svc/fhir/v1/NamingSystem/id-referral-target-reference`;

const ORGANIZATION_ID = "autorouter";
export const AUTOROUTER_PRACTITIONER_ROLE_ID = "autorouter-sender";
const AUTOROUTER_SENDER_NAME = "Autorouter";

const MESSAGE_HEADER_PROFILE_V11 =
  "http://ehealthontario.ca/fhir/StructureDefinition/ca-on-eReferral-profile-MessageHeader|1.0.1";
const MESSAGE_HEADER_PROFILE_V12 =
  "http://ehealthontario.ca/fhir/StructureDefinition/ca-on-eReferral-profile-MessageHeader|1.1.0";
const MESSAGE_HEADER_PROFILE_DEFAULT = MESSAGE_HEADER_PROFILE_V11;

type CreateMessageHeaderParams = {
  eventCode: EReferralEventV11;
  referralRef: string;
  focus?: Reference[];
  version?: "v11" | "v12";
};

export function createMessageHeader({
  eventCode,
  referralRef,
  focus,
  version,
}: CreateMessageHeaderParams): MessageHeader {
  return {
    resourceType: "MessageHeader" as const,
    id: uuid(),
    meta: {
      profile: [
        version === "v12"
          ? MESSAGE_HEADER_PROFILE_V12
          : MESSAGE_HEADER_PROFILE_DEFAULT,
      ],
    },
    extension: [
      {
        url: "http://ehealthontario.ca/fhir/StructureDefinition/ext-id-message-header",
        valueString: referralRef,
      },
    ],
    eventCoding: {
      system: "https://ehealthontario.ca/fhir/CodeSystem/message-event-code",
      code: eventCode,
      display: eventCode,
    },
    sender: {
      reference: "Organization/" + ORGANIZATION_ID,
    },
    author: {
      reference: "PractitionerRole/d96152dd-2bfe-4737-9004-9ccaa3f819d2",
    },
    source: {
      name: "Autorouter",
      endpoint: getSourceEndpoint(),
    },
    focus,
  };
}

export function createMessageBundle({
  resources,
}: {
  resources: FhirResource[];
}): Bundle<FhirResource> {
  return {
    resourceType: "Bundle",
    type: "message",
    total: resources.length,
    entry: resources.map((r) => ({
      fullUrl: r.id ? "urn:uuid:" + r.id : undefined,
      resource: r,
    })),
  };
}

export function createTask({
  status,
  reason,
  description,
  identifier,
  basedOn,
  code,
  communication,
}: {
  status: TaskStatus;
  reason?: string;
  description?: string;
  identifier?: Identifier[];
  basedOn?: Reference[];
  code: TaskCodeV11;
  communication?: Communication;
}): Task {
  return {
    resourceType: "Task",
    id: uuid(),
    status,
    basedOn,
    description,
    identifier,
    statusReason: {
      text: reason,
    },
    code: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-TaskOutcome",
          code,
        },
      ],
    },
    output: communication
      ? [
          {
            type: {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/v3-TaskOutcome",
                  code: "communication",
                },
              ],
            },
            valueReference: {
              reference: "Communication/" + communication.id,
            },
          },
        ]
      : [],
    intent: "order",
  };
}

export function prepareResourcesForResponse(
  serviceRequestBundle: Bundle<FhirResource>
): FhirResource[] {
  return (
    serviceRequestBundle.entry
      ?.map((entry) => {
        const id = entry.fullUrl?.split(":").pop();
        return { id, ...entry.resource } as FhirResource;
      })
      .filter((resource) => resource !== undefined)
      .filter((resource) => resource.resourceType !== "MessageHeader") ?? []
  );
}

export function getReferralRef(
  serviceRequestBundle: Bundle<FhirResource>
): string {
  const messageHeader = serviceRequestBundle.entry?.find(
    (entry) => entry.resource?.resourceType === "MessageHeader"
  )?.resource as MessageHeader;
  return (
    messageHeader?.extension?.find(
      (extension) =>
        extension.url ===
        "http://ehealthontario.ca/fhir/StructureDefinition/ext-referral-identifier"
    )?.valueIdentifier?.value ?? ""
  );
}

export function getServiceRequest(resources: FhirResource[]): ServiceRequest {
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  );
  if (!serviceRequest) {
    throw new InvalidArgumentsError("ServiceRequest not found");
  }
  return serviceRequest as ServiceRequest;
}

export function getOceanReferenceFromServiceRequest(
  serviceRequest: ServiceRequest
): string | null {
  return (
    serviceRequest.identifier?.find(
      (identifier) =>
        identifier.system === OCEAN_REFERRAL_IDENTIFIER_SYSTEM
    )?.value ??
    serviceRequest.id ??
    null
  );
}

export function createCommunication(
  serviceRequest: ServiceRequest,
  message: string,
  sender?: PractitionerRole
): Communication {
  const oceanReferralRef = getOceanReferenceFromServiceRequest(serviceRequest);
  if (!oceanReferralRef) {
    throw new IOError(
      "No ocean referral reference found for service request: " +
        serviceRequest.id
    );
  }
  return {
    resourceType: "Communication",
    id: uuid(),
    status: "completed",
    identifier: [
      {
        system: OCEAN_REFERRAL_IDENTIFIER_SYSTEM,
        value: oceanReferralRef,
      },
    ],
    basedOn: [
      {
        reference: "ServiceRequest/" + serviceRequest.id,
      },
    ],
    payload: [
      {
        contentString: message,
      },
    ],
    sender: sender
      ? {
          reference: "PractitionerRole/" + sender.id,
          identifier: sender.identifier?.[0],
        }
      : undefined,
  };
}

export function createAutorouterSenderPractitionerRole(): PractitionerRole {
  return {
    resourceType: "PractitionerRole",
    id: AUTOROUTER_PRACTITIONER_ROLE_ID,
    identifier: [
      {
        system: `${getDeployUrl()}/fhir/NamingSystem/autorouter-sender`,
        value: AUTOROUTER_SENDER_NAME,
      },
    ],
  };
}
