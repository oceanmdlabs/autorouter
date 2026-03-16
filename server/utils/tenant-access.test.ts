import { describe, expect, it } from "vitest";
import {
  deriveLegacyTenantId,
  mapActiveSystemUserRows,
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

  it("groups authenticated users and memberships for admin browsing", () => {
    expect(
      mapActiveSystemUserRows([
        {
          userId: "user-1",
          displayName: "Alex Admin",
          provider: "google",
          subject: "alex@example.com",
          lastLoginAt: new Date("2026-03-10T12:00:00Z"),
          membershipId: "membership-1",
          membershipTenantId: "tenant-a",
          membershipRole: "admin",
          membershipStatus: "active",
          membershipCreatedAt: new Date("2026-03-01T12:00:00Z"),
        },
        {
          userId: "user-1",
          displayName: "Alex Admin",
          provider: "google",
          subject: "alex@example.com",
          lastLoginAt: new Date("2026-03-10T12:00:00Z"),
          membershipId: "membership-2",
          membershipTenantId: "tenant-b",
          membershipRole: "member",
          membershipStatus: "revoked",
          membershipCreatedAt: new Date("2026-03-02T12:00:00Z"),
        },
        {
          userId: "user-2",
          displayName: "Morgan Member",
          provider: "github",
          subject: "12345",
          lastLoginAt: new Date("2026-03-09T12:00:00Z"),
          membershipId: null,
          membershipTenantId: null,
          membershipRole: null,
          membershipStatus: null,
          membershipCreatedAt: null,
        },
      ])
    ).toEqual([
      {
        id: "user-1",
        name: "Alex Admin",
        provider: "google",
        subject: "alex@example.com",
        lastLoginAt: new Date("2026-03-10T12:00:00Z"),
        memberships: [
          {
            id: "membership-1",
            tenantId: "tenant-a",
            role: "admin",
            status: "active",
            createdAt: new Date("2026-03-01T12:00:00Z"),
          },
          {
            id: "membership-2",
            tenantId: "tenant-b",
            role: "member",
            status: "revoked",
            createdAt: new Date("2026-03-02T12:00:00Z"),
          },
        ],
      },
      {
        id: "user-2",
        name: "Morgan Member",
        provider: "github",
        subject: "12345",
        lastLoginAt: new Date("2026-03-09T12:00:00Z"),
        memberships: [],
      },
    ]);
  });
});
