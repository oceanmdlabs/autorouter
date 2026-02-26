import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import { createAssignMessage } from "../../ocean-message.service";

const TOOL_NAME = "assign";

export const assignHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt
) => {
  let details = null;
  let error = null;
  const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
  if (!serviceRequestBundle) {
    error = "No service request bundle available";
  }
  else {
  const { targetListingName } = action.input;
  const targetListing = await cxt
    .getHealthcareServicesRepository()
    .searchByName(targetListingName);
  if (!targetListing) {
    error = `The target listing '${targetListingName}' was not found. Make sure you have declared the listing in the Listings section.`;
  } else {
    const message = createAssignMessage(serviceRequestBundle, {
      forwardToListingRef: targetListing.oceanReference,
    });
    const response = await cxt.getOceanClientService().sendMessage({
      message,
    });
    if (response.status !== 200) {
      cxt.logger.warn(`Failed to assign service request: ${response.status}`);
      error = "Failed to assign service request";
    } else {
      details = "Assigned";
      }
    }
  }
  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
