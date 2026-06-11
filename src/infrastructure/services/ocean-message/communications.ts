import type { Bundle } from "fhir/r4";
import {
  createAutorouterSenderPractitionerRole,
  createCommunication,
  createMessageBundle,
  createMessageHeader,
  getReferralRef,
  getServiceRequest,
  prepareResourcesForResponse,
} from "./primitives";

export function createSendCommunicationFromProviderMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = getServiceRequest(resources);
  const communication = createCommunication(serviceRequest, message);
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "send-communication-from-provider",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [{ reference: "Communication/" + communication.id }],
      }),
      communication,
      ...resources,
    ],
  });
}

export function createSendCommunicationMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = getServiceRequest(resources);
  const sender = createAutorouterSenderPractitionerRole();
  const communication = createCommunication(serviceRequest, message, sender);
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "send-communication",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [{ reference: "Communication/" + communication.id }],
      }),
      sender,
      communication,
      ...resources,
    ],
  });
}

export function createSendCommunicationFromRequesterMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = getServiceRequest(resources);
  const communication = createCommunication(serviceRequest, message);
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "send-communication-from-requester",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [{ reference: "Communication/" + communication.id }],
      }),
      communication,
      ...resources,
    ],
  });
}
