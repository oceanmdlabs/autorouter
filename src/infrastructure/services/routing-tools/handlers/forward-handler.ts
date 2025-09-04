import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import { createForwardMessage } from "../../ocean-message.service";

const TOOL_NAME = "forward";

export const forwardHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt
) => {
  let details = null;
  let error = null;
  const { targetListingName } = action.input;
  const targetListing = await cxt
    .getHealthcareServicesRepository()
    .searchByName(targetListingName);
  if (!targetListing) {
    error = `The target listing '${targetListingName}' was not found. Make sure you have declared the listing in the Listings section.`;
  } else {
    const message = createForwardMessage(eventContext.serviceRequestBundle, {
      forwardToListingRef: targetListing.oceanReference,
    });
    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {
      cxt.logger.warn(`Failed to forward service request: ${response.status}`);
      error =
        "Failed to forward service request. Among other causes, ensure the destination has a matching health service category.";
    } else {
      details = "Forwarded";
    }
  }
  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
