import { siteConfig, tenantMemberships, users } from "@/drizzle/schema";
import type { TenantMembershipRole, TenantMembershipSummary } from "@/src/entities/models/session";
import { uuid } from "@/src/entities/models/uuid";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { and, asc, eq } from "drizzle-orm";
import { eqEnum, membershipRoleValue, membershipStatusValue } from "./db-enum-helpers";
import type { IdentityProvider, UserIdentity } from "./identity-access";

export interface TenantMemberSummary {
  id: string;
  userId: string;
  name: string;
  tenantId: string;
  role: TenantMembershipRole;
  status: "active" | "revoked";
  createdAt: Date;
}

export function deriveLegacyTenantId(identity: {
  provider: IdentityProvider;
  subject: string;
}) {
  return identity.provider === "github"
    ? `github${identity.subject}`
    : identity.subject;
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
    role: membershipRoleValue("admin"),
    status: membershipStatusValue("active"),
    createdBy: userId,
    updatedBy: userId,
  });

  return await getMembershipsForUser(userId);
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
      role: membershipRoleValue(args.role),
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
      status: membershipStatusValue("revoked"),
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
      eqEnum(tenantMemberships.status, "active", "tenant_membership_status")
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

export async function assignUserToTenant(args: {
  tenantId: string;
  userId: string;
  role: TenantMembershipRole;
  assignedByUserId: string;
}) {
  const db = createDbClient();
  const tenant = await db.query.siteConfig.findFirst({
    where: eq(siteConfig.tenantId, args.tenantId),
    columns: { id: true },
  });

  if (!tenant) {
    throw createError({
      statusCode: 404,
      statusMessage: "Site not found",
    });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, args.userId),
    columns: { id: true },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  const existingMembership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.tenantId, args.tenantId),
      eq(tenantMemberships.userId, args.userId)
    ),
  });

  if (existingMembership) {
    await db
      .update(tenantMemberships)
      .set({
        role: membershipRoleValue(args.role),
        status: membershipStatusValue("active"),
        updatedBy: args.assignedByUserId,
        revokedAt: null,
        revokedBy: null,
      })
      .where(eq(tenantMemberships.id, existingMembership.id));

    return {
      id: existingMembership.id,
      tenantId: args.tenantId,
      userId: args.userId,
      role: args.role,
      status: "active" as const,
    };
  }

  const membershipId = uuid();
  await db.insert(tenantMemberships).values({
    id: membershipId,
    tenantId: args.tenantId,
    userId: args.userId,
    role: membershipRoleValue(args.role),
    status: membershipStatusValue("active"),
    createdBy: args.assignedByUserId,
    updatedBy: args.assignedByUserId,
  });

  return {
    id: membershipId,
    tenantId: args.tenantId,
    userId: args.userId,
    role: args.role,
    status: "active" as const,
  };
}
