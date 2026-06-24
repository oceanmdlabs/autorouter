import type { Appointment, Bundle, ServiceRequest } from "fhir/r4";
import { InvalidArgumentsError } from "@/src/entities/errors/common";
import { uuid } from "@/src/entities/models/uuid";
import {
  createMessageBundle,
  createMessageHeader,
  getReferralRef,
  prepareResourcesForResponse,
} from "./primitives";

export function createSetBookingInstructionsMessage(
  serviceRequestBundle: Bundle,
  { message }: { message: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  ) as ServiceRequest | undefined;
  if (!serviceRequest) {
    throw new InvalidArgumentsError("ServiceRequest not found");
  }
  const appointment: Appointment = {
    resourceType: "Appointment",
    id: uuid(),
    status: "proposed",
    description: message,
    participant: [],
    patientInstruction: message,
  };
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-add-appointment",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [{ reference: "Appointment/" + appointment.id }],
      }),
      appointment,
      ...resources,
    ],
  });
}
