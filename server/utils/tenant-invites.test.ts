import { describe, expect, it } from "vitest";
import { deriveInviteStatus, generateInviteCode } from "./tenant-invites";

describe("generateInviteCode", () => {
  it("produces a base64url string of 24 characters", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it("produces unique codes on each call", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBe(20);
  });
});

describe("deriveInviteStatus", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  it("returns pending for a pending invite that has not expired", () => {
    expect(deriveInviteStatus({ status: "pending", expiresAt: future })).toBe("pending");
  });

  it("returns expired for a pending invite whose expiry has passed", () => {
    expect(deriveInviteStatus({ status: "pending", expiresAt: past })).toBe("expired");
  });

  it("does not override a redeemed status even if expiry is in the past", () => {
    expect(deriveInviteStatus({ status: "redeemed", expiresAt: past })).toBe("redeemed");
  });

  it("does not override a revoked status even if expiry is in the past", () => {
    expect(deriveInviteStatus({ status: "revoked", expiresAt: past })).toBe("revoked");
  });

  it("respects a caller-supplied now timestamp", () => {
    const expiresAt = new Date(1_000_000);
    expect(deriveInviteStatus({ status: "pending", expiresAt }, 999_999)).toBe("pending");
    expect(deriveInviteStatus({ status: "pending", expiresAt }, 1_000_001)).toBe("expired");
  });
});
