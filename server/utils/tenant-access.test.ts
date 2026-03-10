import { describe, expect, it } from "vitest";
import {
  deriveLegacyTenantId,
  resolveActiveTenantId,
} from "./tenant-access";

describe("tenant access helpers", () => {
  it("preserves legacy tenant ids for Google users", () => {
    expect(
      deriveLegacyTenantId({
        provider: "google",
        subject: "google-subject",
      })
    ).toBe("google-subject");
  });

  it("preserves legacy tenant ids for GitHub users", () => {
    expect(
      deriveLegacyTenantId({
        provider: "github",
        subject: "12345",
      })
    ).toBe("github12345");
  });

  it("keeps a requested tenant only when the user is an active member", () => {
    expect(
      resolveActiveTenantId({
        requestedTenantId: "tenant-b",
        isSystemAdmin: false,
        memberships: [
          {
            id: "1",
            tenantId: "tenant-a",
            role: "member",
            status: "active",
          },
          {
            id: "2",
            tenantId: "tenant-b",
            role: "admin",
            status: "active",
          },
        ],
      })
    ).toBe("tenant-b");
  });

  it("falls back when the requested tenant is not an active membership", () => {
    expect(
      resolveActiveTenantId({
        requestedTenantId: "tenant-b",
        isSystemAdmin: false,
        memberships: [
          {
            id: "1",
            tenantId: "tenant-a",
            role: "member",
            status: "active",
          },
          {
            id: "2",
            tenantId: "tenant-b",
            role: "admin",
            status: "revoked",
          },
        ],
      })
    ).toBe("tenant-a");
  });

  it("allows system admins to keep an arbitrary tenant selection", () => {
    expect(
      resolveActiveTenantId({
        requestedTenantId: "tenant-z",
        isSystemAdmin: true,
        memberships: [],
      })
    ).toBe("tenant-z");
  });
});
