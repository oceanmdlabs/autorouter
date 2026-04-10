import type { RoutingEventContext } from "@/src/entities/models/routing-event-context";


export function getReferralRef(eventContext: RoutingEventContext): string | undefined {
  if ("referralRef" in eventContext && typeof eventContext.referralRef === "string") {
    return eventContext.referralRef;
  }
  return undefined;
}


