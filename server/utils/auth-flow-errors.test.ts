import { describe, expect, it } from "vitest";
import {
  buildAuthErrorRedirect,
  getInviteAuthFailureReason,
  isDatabaseResumingError,
} from "./auth-flow-errors";
import { getInviteAuthStatusMessage } from "@/shared/invite-access";

describe("auth flow errors", () => {
  it("detects Aurora auto-pause resume errors", () => {
    expect(
      isDatabaseResumingError(
        new Error("DatabaseResumingException: cluster is resuming after being auto-paused")
      )
    ).toBe(true);
  });

  it("sends database resume failures back to login", () => {
    expect(
      buildAuthErrorRedirect({
        provider: "google",
        error: new Error("DatabaseResumingException"),
      })
    ).toBe("/login?provider=google&reason=database-resuming");
  });

  it("detects invite-gated auth failures", () => {
    expect(
      getInviteAuthFailureReason({
        statusMessage: getInviteAuthStatusMessage("invite-required"),
      })
    ).toBe("invite-required");
  });

  it("sends invite auth failures to the error page with a specific reason", () => {
    expect(
      buildAuthErrorRedirect({
        provider: "github",
        error: {
          statusMessage: getInviteAuthStatusMessage("invite-expired"),
        },
      })
    ).toBe("/error?provider=github&reason=invite-expired");
  });
});
