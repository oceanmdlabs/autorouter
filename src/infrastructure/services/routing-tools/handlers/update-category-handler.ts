import { createDataCorrectionMessageWithNewCode } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "updateCategory";

export const updateCategoryHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const { snomedCode } = action.input;

  let details = null;
  let error = null;
  if (!snomedCode) {
    error = "No SNOMED code provided";
  }
  const serviceRequestBundle = "serviceRequestBundle" in eventContext ? eventContext.serviceRequestBundle : null;
  if (!serviceRequestBundle) {
    error = "No service request bundle available";
  }
  else {
    const message = await createDataCorrectionMessageWithNewCode(
      serviceRequestBundle,
      {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: snomedCode,
            display: snomedCode,
          },
        ],
      }
    );
    const response = await cxt.getOceanClientService().sendMessage({ message });
    if (response.status !== 200) {
      cxt.logger.warn(
        `Failed to change service request category: ${response.status}`
      );
      error = "Failed to change service request category";
    } else {
      details = `Changed service request category to ${snomedCode}`;
    }
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
