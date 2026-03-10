import {
  identityProviderEnum,
  siteConfig,
  systemAdminAllowlist,
  tenantInvites,
  tenantMemberships,
  users,
} from "@/drizzle/schema";
import type {
  TenantMembershipRole,
  TenantMembershipSummary,
} from "@/src/entities/models/session";
import { uuid } from "@/src/entities/models/uuid";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";

export type IdentityProvider = (typeof identityProviderEnum.enumValues)[number];

export interface UserIdentity {
  provider: IdentityProvider;
  subject: string;
  displayName: string;
}

export interface TenantMemberSummary {
  id: string;
  userId: string;
  name: string;
  tenantId: string;
  role: TenantMembershipRole;
  status: "active" | "revoked";
  createdAt: Date;
}

export interface TenantInviteSummary {
  id: string;
  code: string;
  tenantId: string;
  role: TenantMembershipRole;
  status: "pending" | "redeemed" | "revoked" | "expired";
  expiresAt: Date;
  createdAt: Date;
  redeemedAt: Date | null;
}

export function deriveLegacyTenantId(identity: {
  provider: IdentityProvider;
  subject: string;
}) {
  return identity.provider === "github"
    ? `github${identity.subject}`
    : identity.subject;
}

export function generateInviteCode() {
  return randomBytes(18).toString("base64url");
}

export async function isSystemAdmin(
  provider: IdentityProvider,
  subject: string
): Promise<boolean> {
  const db = createDbClient();
  const record = await db.query.systemAdminAllowlist.findFirst({
    where: and(
      eq(systemAdminAllowlist.provider, provider),
      eq(systemAdminAllowlist.subject, subject),
      eq(systemAdminAllowlist.active, true)
    ),
  });
  return Boolean(record);
}

export async function upsertOAuthUser(identity: UserIdentity) {
  const db = createDbClient();
  const existing = await db.query.users.findFirst({
    where: and(
      eq(users.provider, identity.provider),
      eq(users.subject, identity.subject)
    ),
  });

  if (existing) {
    await db
      .update(users)
      .set({
        displayName: identity.displayName,
        lastLoginAt: new Date(),
        updatedBy: existing.id,
      })
      .where(eq(users.id, existing.id));

    return {
      ...existing,
      displayName: identity.displayName,
      lastLoginAt: new Date(),
    };
  }

  const user = {
    id: uuid(),
    provider: identity.provider,
    subject: identity.subject,
    displayName: identity.displayName,
    lastLoginAt: new Date(),
    createdBy: "system",
    updatedBy: "system",
  } as const;

  await db.insert(users).values(user);
  return await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });
}

export async function getUserById(userId: string) {
  const db = createDbClient();
  return await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function getMembershipsForUser(
  userId: string
): Promise<TenantMembershipSummary[]> {
  const db = createDbClient();
  return await db
    .select({
      id: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
      status: tenantMemberships.status,
    })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, userId))
    .orderBy(asc(tenantMemberships.tenantId));
}

export async function ensureLegacyMembership(identity: UserIdentity, userId: string) {
  const memberships = await getMembershipsForUser(userId);
  if (memberships.some((membership) => membership.status === "active")) {
    return memberships;
  }

  const tenantId = deriveLegacyTenantId(identity);
  const db = createDbClient();
  const existingTenant = await db.query.siteConfig.findFirst({
    where: eq(siteConfig.tenantId, tenantId),
  });

  if (!existingTenant) {
    return memberships;
  }

  await db.insert(tenantMemberships).values({
    id: uuid(),
    tenantId,
    userId,
    role: "admin",
    status: "active",
    createdBy: userId,
    updatedBy: userId,
  });

  return await getMembershipsForUser(userId);
}

export function resolveActiveTenantId(args: {
  requestedTenantId?: string | null;
  memberships: TenantMembershipSummary[];
  isSystemAdmin: boolean;
}) {
  const activeMemberships = args.memberships.filter(
    (membership) => membership.status === "active"
  );

  if (args.isSystemAdmin && args.requestedTenantId) {
    return args.requestedTenantId;
  }

  if (
    args.requestedTenantId &&
    activeMemberships.some(
      (membership) => membership.tenantId === args.requestedTenantId
    )
  ) {
    return args.requestedTenantId;
  }

  return activeMemberships[0]?.tenantId ?? null;
}

export async function getTenantMembers(
  tenantId: string
): Promise<TenantMemberSummary[]> {
  const db = createDbClient();
  return await db
    .select({
      id: tenantMemberships.id,
      userId: users.id,
      name: users.displayName,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
      status: tenantMemberships.status,
      createdAt: tenantMemberships.createdAt,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(tenantMemberships.userId, users.id))
    .where(eq(tenantMemberships.tenantId, tenantId))
    .orderBy(asc(users.displayName), asc(tenantMemberships.createdAt));
}

export async function getTenantInvites(
  tenantId: string
): Promise<TenantInviteSummary[]> {
  const db = createDbClient();
  const records = await db.query.tenantInvites.findMany({
    where: eq(tenantInvites.tenantId, tenantId),
    orderBy: [desc(tenantInvites.createdAt)],
  });

  const now = Date.now();
  return records.map((record) => ({
    ...record,
    status:
      record.status === "pending" && record.expiresAt.getTime() < now
        ? "expired"
        : record.status,
  }));
}

export async function createTenantInvite(args: {
  tenantId: string;
  invitedByUserId: string;
  role: TenantMembershipRole;
  expiresAt: Date;
}) {
  const db = createDbClient();
  const invite = {
    id: uuid(),
    tenantId: args.tenantId,
    code: generateInviteCode(),
    role: args.role,
    status: "pending" as const,
    invitedByUserId: args.invitedByUserId,
    createdBy: args.invitedByUserId,
    updatedBy: args.invitedByUserId,
    expiresAt: args.expiresAt,
  };

  await db.insert(tenantInvites).values(invite);
  return invite;
}

export async function revokeTenantInvite(args: {
  tenantId: string;
  inviteId: string;
  revokedByUserId: string;
}) {
  const db = createDbClient();
  await db
    .update(tenantInvites)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: args.revokedByUserId,
      updatedBy: args.revokedByUserId,
    })
    .where(
      and(
        eq(tenantInvites.id, args.inviteId),
        eq(tenantInvites.tenantId, args.tenantId)
      )
    );
}

export async function redeemTenantInvite(args: {
  code: string;
  userId: string;
}) {
  const db = createDbClient();
  const invite = await db.query.tenantInvites.findFirst({
    where: eq(tenantInvites.code, args.code),
  });

  if (!invite) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invite not found",
    });
  }

  if (invite.status === "revoked") {
    throw createError({
      statusCode: 410,
      statusMessage: "Invite has been revoked",
    });
  }

  if (invite.status === "redeemed") {
    throw createError({
      statusCode: 409,
      statusMessage: "Invite has already been redeemed",
    });
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(tenantInvites)
      .set({
        status: "expired",
        updatedBy: args.userId,
      })
      .where(eq(tenantInvites.id, invite.id));

    throw createError({
      statusCode: 410,
      statusMessage: "Invite has expired",
    });
  }

  const existingMembership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.tenantId, invite.tenantId),
      eq(tenantMemberships.userId, args.userId)
    ),
  });

  if (existingMembership) {
    await db
      .update(tenantMemberships)
      .set({
        role: invite.role,
        status: "active",
        revokedAt: null,
        revokedBy: null,
        updatedBy: args.userId,
      })
      .where(eq(tenantMemberships.id, existingMembership.id));
  } else {
    await db.insert(tenantMemberships).values({
      id: uuid(),
      tenantId: invite.tenantId,
      userId: args.userId,
      role: invite.role,
      status: "active",
      createdBy: args.userId,
      updatedBy: args.userId,
    });
  }

  await db
    .update(tenantInvites)
    .set({
      status: "redeemed",
      redeemedAt: new Date(),
      redeemedByUserId: args.userId,
      updatedBy: args.userId,
    })
    .where(eq(tenantInvites.id, invite.id));

  return invite;
}

export async function updateMembershipRole(args: {
  tenantId: string;
  membershipId: string;
  role: TenantMembershipRole;
  updatedByUserId: string;
}) {
  const db = createDbClient();
  await db
    .update(tenantMemberships)
    .set({
      role: args.role,
      updatedBy: args.updatedByUserId,
    })
    .where(
      and(
        eq(tenantMemberships.id, args.membershipId),
        eq(tenantMemberships.tenantId, args.tenantId)
      )
    );
}

export async function revokeMembership(args: {
  tenantId: string;
  membershipId: string;
  revokedByUserId: string;
}) {
  const db = createDbClient();
  await db
    .update(tenantMemberships)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedBy: args.revokedByUserId,
      updatedBy: args.revokedByUserId,
    })
    .where(
      and(
        eq(tenantMemberships.id, args.membershipId),
        eq(tenantMemberships.tenantId, args.tenantId)
      )
    );
}

export async function assertActiveMembership(args: {
  tenantId: string;
  userId: string;
}) {
  const db = createDbClient();
  const membership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.tenantId, args.tenantId),
      eq(tenantMemberships.userId, args.userId),
      eq(tenantMemberships.status, "active")
    ),
  });

  if (!membership) {
    throw createError({
      statusCode: 403,
      statusMessage: "You are not a member of this tenant",
    });
  }

  return membership;
}

export async function assertTenantAdmin(args: {
  tenantId: string;
  userId: string;
}) {
  const membership = await assertActiveMembership(args);
  if (membership.role !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "Tenant admin access is required",
    });
  }
  return membership;
}

export async function isKnownTenant(tenantId: string) {
  const db = createDbClient();
  const tenant = await db.query.siteConfig.findFirst({
    where: eq(siteConfig.tenantId, tenantId),
    columns: { id: true },
  });
  return Boolean(tenant);
}

export async function findInviteForCode(code: string) {
  const db = createDbClient();
  const invite = await db.query.tenantInvites.findFirst({
    where: and(eq(tenantInvites.code, code), gt(tenantInvites.expiresAt, new Date())),
  });
  return invite ?? null;
}
