import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "setBookingInstructions";
const parameters = z.object({
  message: z.string(),
});

export const setBookingInstructionsTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  displayName: "Set Booking Instructions",
  input: parameters,
  description: "Provide booking instructions",
  handler: async (action, eventContext, cxt) => {
    // Dynamically import the handler to avoid loading server-side dependencies on the client
    const { setBookingInstructionsHandler } = await import(
      "./handlers/set-booking-instructions-handler"
    );
    return setBookingInstructionsHandler(action, eventContext, cxt);
  },
};
