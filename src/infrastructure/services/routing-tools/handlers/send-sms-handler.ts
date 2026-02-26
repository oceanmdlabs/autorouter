import Twilio from "twilio";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import { ConfigurationError } from "@/src/entities/errors/common";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";

const TOOL_NAME = "sendSms";

export const sendSmsHandler: RoutingToolHandler<typeof TOOL_NAME> = async (
  action,
  eventContext,
  cxt
) => {
  const { message, phoneNumber } = action.input;
  const siteConfig = await cxt.getSiteConfigurationRepository().getForTenant();
  if (!siteConfig) {
    throw new ConfigurationError("Site configuration not found");
  }
  const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = siteConfig;
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    await cxt.getActivityLogEntriesRepository().create({
      ...eventContext,
      error: "Twilio credentials not found",
    });
    return;
  }
  const client = Twilio(twilioAccountSid, twilioAuthToken);
  const twilioMessage: MessageInstance = await client.messages.create({
    body: message,
    from: twilioPhoneNumber,
    to: phoneNumber,
  });

  let details = null,
    error = null;
  if (twilioMessage.status === "failed") {
    error = twilioMessage.errorMessage;
  } else {
    details = `Sent SMS: "${message}" to ${phoneNumber}`;
  }

  await cxt.getActivityLogEntriesRepository().create({
    ...eventContext,
    tool: TOOL_NAME,
    details,
    error,
  });
};
