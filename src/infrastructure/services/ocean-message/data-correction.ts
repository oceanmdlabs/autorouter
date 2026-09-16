import type { Bundle, CodeableConcept, ServiceRequest } from "fhir/r4";
import { InvalidArgumentsError } from "@/src/entities/errors/common";
import {
  createMessageHeader,
  getReferralRef,
  prepareResourcesForResponse,
} from "./primitives";

export async function createDataCorrectionMessageWithNewCode(
  serviceRequestBundle: Bundle,
  code: CodeableConcept
): Promise<Bundle> {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const serviceRequest = resources.find(
    (resource) => resource.resourceType === "ServiceRequest"
  ) as ServiceRequest | undefined;
  if (!serviceRequest) {
    throw new InvalidArgumentsError("ServiceRequest not found");
  }
  serviceRequest.code = {
    ...serviceRequest.code,
    coding: [
      ...(serviceRequest.code?.coding || []).filter(
        (existingCode) => existingCode.system !== code.coding?.[0]?.system
      ),
      ...(code.coding || []),
    ],
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
          focus: [{ reference: "ServiceRequest/" + serviceRequest.id }],
        }),
      },
      ...resources.map((resource) => ({ resource })),
    ],
  };
}
