import type {
  Bundle,
  FhirResource,
  PractitionerRole,
  ServiceRequest,
} from "fhir/r4";
import { InvalidArgumentsError, IOError } from "@/src/entities/errors/common";
import { uuid } from "@/src/entities/models/uuid";
import {
  createMessageBundle,
  createMessageHeader,
  createTask,
  getReferralRef,
  prepareResourcesForResponse,
  type TaskCodeV11,
} from "./primitives";

export function createForwardMessage(
  serviceRequestBundle: Bundle,
  { forwardToListingRef }: { forwardToListingRef: string }
): Bundle<FhirResource> {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  ) as ServiceRequest | undefined;
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
  ) as PractitionerRole[];
  const forwardTo: PractitionerRole = {
    resourceType: "PractitionerRole",
    id: uuid(),
    identifier: [
      {
        system: "id-referral-target-reference",
        value: forwardToListingRef,
      },
    ],
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
            code: snomedCodeToUse,
          },
        ],
      },
    ],
    replaces: [
      {
        reference: "ServiceRequest/" + serviceRequest.id,
      },
    ],
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
        reference: "ServiceRequest/" + updatedServiceRequest.id,
      },
    ],
  });
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-update-process-request",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [{ reference: "Task/" + task.id }],
      }),
      patient,
      serviceRequest,
      updatedServiceRequest,
      ...practitionerRoles,
      forwardTo,
      task,
    ],
  });
}

export function createAssignMessage(
  serviceRequestBundle: Bundle,
  { forwardToListingRef }: { forwardToListingRef: string }
): Bundle<FhirResource> {
  // no explicit assign event in the FHIR spec; forward is used instead
  return createForwardMessage(serviceRequestBundle, { forwardToListingRef });
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

  return (
    serviceRequest.category?.[0]?.coding?.find(
      (c) => c.system === "http://snomed.info/sct"
    )?.code ?? practitionerSnomedCodes[0]
  );
}
