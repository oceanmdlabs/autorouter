import type {
  Appointment,
  Bundle,
  CodeableConcept,
  Communication,
  FhirResource,
  Identifier,
  MessageHeader,
  PractitionerRole,
  Reference,
  ServiceRequest,
  Task
} from "fhir/r4";
import { getSourceEndpoint } from "@/src/application/services/ocean-server.utils";
import { InvalidArgumentsError, IOError } from "@/src/entities/errors/common";
import { uuid } from "@/src/entities/models/uuid";

type EReferralEventV11 =
  | "notify-add-process-request"
  | "notify-add-appointment"
  | "notify-update-process-request"
  | "send-communication-from-provider"
  | "send-communication-from-requester"
  | "send-communication"
  | "notify-data-correction";

// type EReferralEventV12 =
//   | "add-service-request"
//   | "notify-add-process-request"
//   | "notify-add-appointment"
//   | "notify-update-process-request"
//   | "send-communication-from-provider"
//   | "send-communication-from-requester"
//   | "notify-data-correction"
//   | "notify-update-service-request"
//   | "revoke-service-request";

const ORGANIZATION_ID = "oceanmd-autorouter";

type CreateMessageHeaderParams = {
  eventCode: EReferralEventV11;
  referralRef: string;
  focus?: Reference[];
  version?: "v11" | "v12";
};

type TaskCodeV11 =
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

const OCEAN_SERVER_URL = "https://ocean.cognisantmd.com";
const MESSAGE_HEADER_PROFILE_V11 =
  "http://ehealthontario.ca/fhir/StructureDefinition/ca-on-eReferral-profile-MessageHeader|1.0.1";

const MESSAGE_HEADER_PROFILE_V12 =
  "http://ehealthontario.ca/fhir/StructureDefinition/ca-on-eReferral-profile-MessageHeader|1.1.0";
// https://simplifier.net/guide/ca-on-ereferral-r4-iguide/Index/fhirartifacts/MessageHeader?version=0.12.2

const MESSAGE_HEADER_PROFILE_DEFAULT = MESSAGE_HEADER_PROFILE_V11;

export function createMessageHeader({
                                      eventCode,
                                      referralRef,
                                      focus,
                                      version
                                    }: CreateMessageHeaderParams): MessageHeader {
  return {
    resourceType: "MessageHeader" as const,
    id: uuid(),
    meta: {
      profile: [
        version === "v12"
          ? MESSAGE_HEADER_PROFILE_V12
          : MESSAGE_HEADER_PROFILE_DEFAULT
      ]
    },
    extension: [
      {
        url: "http://ehealthontario.ca/fhir/StructureDefinition/ext-id-message-header",
        valueString: referralRef
      }
    ],
    eventCoding: {
      system: "https://ehealthontario.ca/fhir/CodeSystem/message-event-code",
      code: eventCode,
      display: eventCode
    },
    sender: {
      reference: "Organization/" + ORGANIZATION_ID
    },
    author: {
      reference: "PractitionerRole/d96152dd-2bfe-4737-9004-9ccaa3f819d2"
    },
    source: {
      name: "Autorouter",
      endpoint: getSourceEndpoint()
    },
    focus
  };
}

export function createMessageBundle({
                                      resources
                                    }: {
  resources: FhirResource[];
}): Bundle<FhirResource> {
  return {
    resourceType: "Bundle",
    type: "message",
    total: resources.length,
    entry: resources.map((r) => {
      return {
        fullUrl: r.id ? "urn:uuid:" + r.id : undefined,
        resource: r
      };
    })
  };
}

export function createAssignMessage(
  serviceRequestBundle: Bundle,
  { forwardToListingRef }: { forwardToListingRef: string }
): Bundle<FhirResource> {
  // no explicit support for assign in the FHIR spec, so we use forward for now
  return createForwardMessage(serviceRequestBundle, { forwardToListingRef });
}

export function createToggleEConsultMessage(
  serviceRequestBundle: Bundle,
  { changeToEConsult }: { changeToEConsult: boolean }
): Bundle<FhirResource> {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const existingTask = resources.find(
    (resource) => resource.resourceType === "Task"
  );
  const wasEConsult =
    existingTask?.code?.coding?.[0]?.code === "process-request-consult";
  const task = createTask({
    status: existingTask?.status as TaskStatus,
    code: wasEConsult ? "process-request-consult" : "process-request",
    identifier: existingTask?.identifier
  });
  task.extension = [
    {
      url: "http://ehealthontario.ca/fhir/StructureDefinition/ca-on-eConsult-ext-patient-needs-to-be-seen",
      valueBoolean: !changeToEConsult
    }
  ];
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-update-process-request",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [
          {
            reference: "Task/" + task.id
          }
        ]
      }),
      ...resources,
      task
    ]
  });
}

export function createForwardMessage(
  serviceRequestBundle: Bundle,
  { forwardToListingRef }: { forwardToListingRef: string }
): Bundle<FhirResource> {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  );
  if (!serviceRequest) {
    throw new InvalidArgumentsError("ServiceRequest not found");
  }
  const patient = resources.find(
    (resource) => resource.resourceType === "Patient"
  );
  if (!patient) {
    throw new InvalidArgumentsError("Patient not found");
  }
  const practitionerRoles = resources.filter(
    (resource) => resource.resourceType === "PractitionerRole"
  );
  const forwardTo: PractitionerRole = {
    resourceType: "PractitionerRole",
    id: uuid(),
    identifier: [
      {
        system: "id-referral-target-reference",
        value: forwardToListingRef
      }
    ]
  };
  const snomedCodeToUse = determineSnomedCodeToUseForForwardCategory(
    practitionerRoles,
    serviceRequest
  );
  if (!snomedCodeToUse) {
    throw new IOError(
      "No snomed code was found that can be used when forwarding the service request."
    );
  }
  const updatedServiceRequest = {
    ...serviceRequest,
    id: uuid(),
    performer: [{ reference: "PractitionerRole/" + forwardTo.id }],
    category: [
      {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: snomedCodeToUse
          }
        ]
      }
    ],
    replaces: [
      {
        reference: "ServiceRequest/" + serviceRequest.id
      }
    ]
  };
  const existingTask = resources.find(
    (resource) => resource.resourceType === "Task"
  );
  const task = createTask({
    status: "requested",
    code:
      (existingTask?.code?.coding?.[0]?.code as TaskCodeV11) ??
      "process-request",
    identifier: existingTask?.identifier,
    basedOn: [
      {
        reference: "ServiceRequest/" + updatedServiceRequest.id
      }
    ]
  });
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-update-process-request",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [
          {
            reference: "Task/" + task.id
          }
        ]
      }),
      patient,
      serviceRequest,
      updatedServiceRequest,
      ...practitionerRoles,
      forwardTo,
      task
    ]
  });
}

function determineSnomedCodeToUseForForwardCategory(
  practitionerRoles: PractitionerRole[],
  serviceRequest: ServiceRequest
) {
  const practitionerSnomedCodes = practitionerRoles
    .map((pr) => pr.specialty)
    .flat()
    .filter((s) => s?.coding?.[0]?.system === "http://snomed.info/sct")
    .map((s) => s?.coding?.[0]?.code);

  const snomedCodeToUse =
    serviceRequest.category?.[0]?.coding?.find(
      (c) => c.system === "http://snomed.info/sct"
    )?.code ?? practitionerSnomedCodes[0];
  return snomedCodeToUse;
}

export function createStatusChangeMessage(
  serviceRequestBundle: Bundle,
  {
    status,
    reason,
    description
  }: { status: TaskStatus; reason: string; description: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const task = createTask({
    status,
    reason,
    description,
    code: "process-request"
  });

  if (status === "accepted") {
    task.extension = [
      {
        url: "https://ocean.cognisantmd.com/svc/v1/Structure-Definition/ext-accept-service-request-import|1.0",
        valueBoolean: true // if true, this tells Ocean to upsertPatientAction (push to EMR)
      }
    ];
  }

  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-update-process-request",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [
          {
            reference: "Task/" + task.id
          }
        ]
      }),
      task,
      ...resources
    ]
  });
}

export function createSetBookingInstructionsMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  );
  if (!serviceRequest) {
    throw new InvalidArgumentsError("ServiceRequest not found");
  }
  const appointment: Appointment = {
    resourceType: "Appointment",
    id: uuid(),
    status: "proposed",
    description: message,
    participant: [],
    patientInstruction: message
    // Wait time setting is not yet supported; we can set the wtType, but it's only useful with an actual appointment
    // extension: [
    //   {
    //     url: `${OCEAN_SERVER_URL}/svc/fhir/v1/StructureDefinition/ext-ontario-clinical-wait-time-appointment-milestones`,
    //     valueString: "wait-1",
    //   },
    // ],
  };
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-add-appointment",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [
          {
            reference: "Appointment/" + appointment.id
          }
        ]
      }),
      appointment,
      ...resources
    ]
  });
}

export function createSendCommunicationFromProviderMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = getServiceRequest(resources);
  const communication: Communication = createCommunication(
    serviceRequest,
    message
  );
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "send-communication-from-provider",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [
          {
            reference: "Communication/" + communication.id
          }
        ]
      }),
      communication,
      ...resources
    ]
  });
}

export function createSendCommunicationMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = getServiceRequest(resources);
  const communication: Communication = createCommunication(
    serviceRequest,
    message
  );
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "send-communication",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [
          {
            reference: "Communication/" + communication.id
          }
        ]
      }),
      communication,
      ...resources
    ]
  });
}


export function createSendCommunicationFromRequesterMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = getServiceRequest(resources);
  const communication: Communication = createCommunication(
    serviceRequest,
    message
  );
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "send-communication-from-requester",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [
          {
            reference: "Communication/" + communication.id
          }
        ]
      }),
      communication,
      ...resources
    ]
  });
}

function getServiceRequest(resources: FhirResource[]): ServiceRequest {
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  );
  if (!serviceRequest) {
    throw new InvalidArgumentsError("ServiceRequest not found");
  }
  return serviceRequest;
}

const OCEAN_REFERRAL_IDENTIFIER_SYSTEM = `${OCEAN_SERVER_URL}/svc/fhir/v1/NamingSystem/id-referral-target-reference`;

function createCommunication(
  serviceRequest: ServiceRequest,
  message: string
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
        value: oceanReferralRef
      }
    ],
    basedOn: [
      {
        reference: "ServiceRequest/" + serviceRequest.id
      }
    ],
    payload: [
      {
        contentString: message
      }
    ],
    sender: {
      identifier: {
        value: "Autorouter"
      }
    }
  };
}

function getOceanReferenceFromServiceRequest(
  serviceRequest: ServiceRequest
): string | null {
  return (
    serviceRequest.identifier?.find(
      (identifier) => identifier.system === OCEAN_REFERRAL_IDENTIFIER_SYSTEM
    )?.value ??
    serviceRequest.id ??
    null
  );
}

export async function createDataCorrectionMessageWithNewCode(
  serviceRequestBundle: Bundle,
  code: CodeableConcept
): Promise<Bundle> {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  );
  if (!serviceRequest) {
    throw new InvalidArgumentsError("ServiceRequest not found");
  }
  serviceRequest.code = {
    ...serviceRequest.code,
    coding: [
      ...(serviceRequest.code?.coding || []).filter(
        (existingCode) => existingCode.system !== code.coding?.[0]?.system
      ),
      ...(code.coding || [])
    ]
  };

  return {
    resourceType: "Bundle",
    type: "message",
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: createMessageHeader({
          eventCode: "notify-data-correction",
          referralRef: getReferralRef(serviceRequestBundle),
          focus: [
            {
              reference: "ServiceRequest/" + serviceRequest.id
            }
          ]
        })
      },
      ...resources.map((resource) => ({ resource }))
    ]
  };
}

function prepareResourcesForResponse(
  serviceRequestBundle: Bundle<FhirResource>
) {
  return (
    serviceRequestBundle.entry
      ?.map((entry) => {
        // map the fullUrl to an id if it exists:
        const id = entry.fullUrl?.split(":").pop();
        return { id, ...entry.resource } as FhirResource;
      })
      .filter((resource) => resource !== undefined)
      .filter((resource) => resource.resourceType !== "MessageHeader") ?? []
  );
}

function createTask({
                      status,
                      reason,
                      description,
                      identifier,
                      basedOn,
                      code,
                      communication
                    }: {
  status: TaskStatus;
  reason?: string;
  description?: string; // used for message content
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
      text: reason
    },
    code: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-TaskOutcome",
          code
        }
      ]
    },
    output: communication
      ? [
        {
          type: {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/v3-TaskOutcome",
                code: "communication"
              }
            ]
          },
          valueReference: {
            reference: "Communication/" + communication.id
          }
        }
      ]
      : [],
    intent: "order"
  };
}

function getReferralRef(serviceRequestBundle: Bundle<FhirResource>): string {
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
