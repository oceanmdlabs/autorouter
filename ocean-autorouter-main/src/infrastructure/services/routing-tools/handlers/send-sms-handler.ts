import Twilio from "twilio";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import { ConfigurationError } from "@/src/entities/errors/common";
import type { RoutingToolHandler } from "@/src/entities/models/routing-tool";
import type { LogToolEvent } from "@/src/entities/models/logger";
import { getReferralRef } from "@/src/infrastructure/services/routing-tools/handlers/handler.utils";

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

    let error = "Twilio configuration is not set up";
    const logDetails: LogToolEvent = {
      event: "tool.execution.error",
      message: error,
      tool: TOOL_NAME,
      timestamp: new Date().toISOString(),
      referralRef: getReferralRef(eventContext),
      actionId: action.id
    };

    cxt.logger.error(logDetails);

    return {
      tool: TOOL_NAME,
      success: false,
      error: error,
      routingEventContext: eventContext
    };

  }
  const client = Twilio(twilioAccountSid, twilioAuthToken);
  const twilioMessage: MessageInstance = await client.messages.create({
    body: message,
    from: twilioPhoneNumber,
    to: phoneNumber
  });

  let error = null;
  if (twilioMessage.status === "failed") {
    error = twilioMessage.errorMessage;

    const logDetails: LogToolEvent = {
      event: "tool.execution.error",
      message: `Failed to send SMS: ${error}`,
      tool: TOOL_NAME,
      timestamp: new Date().toISOString(),
      referralRef: getReferralRef(eventContext),
      actionId: action.id
    };

    cxt.logger.error(logDetails);

  } else {
    const logDetails: LogToolEvent = {
      event: "tool.execution.success",
      message: "SMS sent successfully",
      tool: TOOL_NAME,
      timestamp: new Date().toISOString(),
      referralRef: getReferralRef(eventContext),
      actionId: action.id
    };
    cxt.logger.info(logDetails);
  }

  return {
    tool: TOOL_NAME,
    success: !error,
    error: error,
    routingEventContext: eventContext
  };

};
