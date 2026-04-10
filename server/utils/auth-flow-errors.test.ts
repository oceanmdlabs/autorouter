import { describe, expect, it } from "vitest";
import { buildAuthErrorRedirect, isDatabaseResumingError } from "./auth-flow-errors";

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
});
