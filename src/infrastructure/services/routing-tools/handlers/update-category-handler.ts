import { createDataCorrectionMessageWithNewCode } from "../../ocean-message.service";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "updateCategory";

export const updateCategoryHandler: RoutingToolHandler<
  typeof TOOL_NAME
> = async (action, eventContext, cxt) => {
  const { snomedCode } = action.input;

  if (!snomedCode) {
    return;
  }

  const message = await createDataCorrectionMessageWithNewCode(
    eventContext.serviceRequestBundle,
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
  let details = null;
  let error = null;
  const response = await cxt.getOceanClientService().sendMessage({ message });
  if (response.status !== 200) {
    cxt.logger.warn(
      `Failed to change service request category: ${response.status}`
    );
    error = "Failed to change service request category";
  } else {
    details = `Changed service request category to ${snomedCode}`;
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
