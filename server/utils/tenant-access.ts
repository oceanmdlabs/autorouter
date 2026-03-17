import {
  aiProviderEnum,
  identityProviderEnum,
  oceanServerEnum,
  siteConfig,
  systemAdminAllowlist,
  tenantInvites,
  tenantInviteStatusEnum,
  tenantMemberships,
  tenantMembershipRoleEnum,
  tenantMembershipStatusEnum,
  users,
} from "@/drizzle/schema";
import type {
  TenantMembershipRole,
  TenantMembershipSummary,
} from "@/src/entities/models/session";
import { uuid } from "@/src/entities/models/uuid";
import { createCryptoService } from "@/src/infrastructure/services/crypto.service";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { and, asc, desc, eq, gt, ilike, isNotNull, or, sql } from "drizzle-orm";
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

export interface ActiveSystemUserMembershipSummary {
  id: string;
  tenantId: string;
  role: TenantMembershipRole;
  status: "active" | "revoked";
  createdAt: Date;
}

export interface ActiveSystemUserSummary {
  id: string;
  name: string;
  provider: IdentityProvider;
  subject: string;
  lastLoginAt: Date;
  memberships: ActiveSystemUserMembershipSummary[];
}

interface ActiveSystemUserRow {
  userId: string;
  displayName: string;
  provider: IdentityProvider;
  subject: string;
  lastLoginAt: Date;
  membershipId: string | null;
  membershipTenantId: string | null;
  membershipRole: TenantMembershipRole | null;
  membershipStatus: "active" | "revoked" | null;
  membershipCreatedAt: Date | null;
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

export function mapActiveSystemUserRows(
  rows: ActiveSystemUserRow[]
): ActiveSystemUserSummary[] {
  const usersById = new Map<string, ActiveSystemUserSummary>();

  for (const row of rows) {
    const existing =
      usersById.get(row.userId) ??
      ({
        id: row.userId,
        name: row.displayName,
        provider: row.provider,
        subject: row.subject,
        lastLoginAt: row.lastLoginAt,
        memberships: [],
      } satisfies ActiveSystemUserSummary);

    if (!usersById.has(row.userId)) {
      usersById.set(row.userId, existing);
    }

    if (
      row.membershipId &&
      row.membershipTenantId &&
      row.membershipRole &&
      row.membershipStatus &&
      row.membershipCreatedAt
    ) {
      existing.memberships.push({
        id: row.membershipId,
        tenantId: row.membershipTenantId,
        role: row.membershipRole,
        status: row.membershipStatus,
        createdAt: row.membershipCreatedAt,
      });
    }
  }

  return Array.from(usersById.values());
}

type EnumColumn =
  | typeof users.provider
  | typeof systemAdminAllowlist.provider
  | typeof tenantMemberships.role
  | typeof tenantMemberships.status
  | typeof tenantInvites.role
  | typeof tenantInvites.status
  | typeof siteConfig.oceanServer
  | typeof siteConfig.aiProvider;

function castEnumValue<TValue extends string>(
  value: TValue,
  enumName:
    | "identity_provider"
    | "tenant_membership_role"
    | "tenant_membership_status"
    | "tenant_invite_status"
    | "ocean_server"
    | "ai_provider"
) {
  return sql`${value}::${sql.raw(enumName)}`;
}

function eqEnum<TValue extends string>(
  column: EnumColumn,
  value: TValue,
  enumName:
    | "identity_provider"
    | "tenant_membership_role"
    | "tenant_membership_status"
    | "tenant_invite_status"
    | "ocean_server"
    | "ai_provider"
) {
  return sql`${column} = ${castEnumValue(value, enumName)}`;
}

function identityProviderValue(provider: IdentityProvider) {
  return castEnumValue(provider, "identity_provider");
}

function membershipRoleValue(role: (typeof tenantMembershipRoleEnum.enumValues)[number]) {
  return castEnumValue(role, "tenant_membership_role");
}

function membershipStatusValue(
  status: (typeof tenantMembershipStatusEnum.enumValues)[number]
) {
  return castEnumValue(status, "tenant_membership_status");
}

function inviteStatusValue(status: (typeof tenantInviteStatusEnum.enumValues)[number]) {
  return castEnumValue(status, "tenant_invite_status");
}

function oceanServerValue(server: (typeof oceanServerEnum.enumValues)[number]) {
  return castEnumValue(server, "ocean_server");
}

function aiProviderValue(
  provider: (typeof aiProviderEnum.enumValues)[number] | null
) {
  return provider === null ? null : castEnumValue(provider, "ai_provider");
}

export async function isSystemAdmin(
  provider: IdentityProvider,
  subject: string
): Promise<boolean> {
  const db = createDbClient();
  const record = await db.query.systemAdminAllowlist.findFirst({
    where: and(
      eqEnum(systemAdminAllowlist.provider, provider, "identity_provider"),
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
      eqEnum(users.provider, identity.provider, "identity_provider"),
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
    provider: identityProviderValue(identity.provider),
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

export async function listActiveSystemUsers(args?: {
  search?: string | null;
}): Promise<ActiveSystemUserSummary[]> {
  const db = createDbClient();
  const search = args?.search?.trim();
  const filters = [isNotNull(users.lastLoginAt)];

  if (search) {
    const searchPattern = `%${search}%`;
    filters.push(
      or(
        ilike(users.displayName, searchPattern),
        ilike(users.subject, searchPattern),
        sql`CAST(${users.provider} AS text) ILIKE ${searchPattern}`,
        ilike(tenantMemberships.tenantId, searchPattern)
      )!
    );
  }

  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      provider: users.provider,
      subject: users.subject,
      lastLoginAt: users.lastLoginAt,
      membershipId: tenantMemberships.id,
      membershipTenantId: tenantMemberships.tenantId,
      membershipRole: tenantMemberships.role,
      membershipStatus: tenantMemberships.status,
      membershipCreatedAt: tenantMemberships.createdAt,
    })
    .from(users)
    .leftJoin(tenantMemberships, eq(tenantMemberships.userId, users.id))
    .where(and(...filters))
    .orderBy(
      asc(users.displayName),
      asc(users.subject),
      asc(tenantMemberships.tenantId),
      asc(tenantMemberships.createdAt)
    );

  return mapActiveSystemUserRows(
    rows.filter(
      (row): row is ActiveSystemUserRow => row.lastLoginAt instanceof Date
    )
  );
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
  const dbInvite = {
    ...invite,
    role: membershipRoleValue(args.role),
    status: inviteStatusValue("pending"),
  };

  await db.insert(tenantInvites).values(dbInvite);
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
      status: inviteStatusValue("revoked"),
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
        status: inviteStatusValue("expired"),
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
        role: membershipRoleValue(invite.role),
        status: membershipStatusValue("active"),
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
      role: membershipRoleValue(invite.role),
      status: membershipStatusValue("active"),
      createdBy: args.userId,
      updatedBy: args.userId,
    });
  }

  await db
    .update(tenantInvites)
    .set({
      status: inviteStatusValue("redeemed"),
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

export async function isKnownTenant(tenantId: string) {
  const db = createDbClient();
  const tenant = await db.query.siteConfig.findFirst({
    where: eq(siteConfig.tenantId, tenantId),
    columns: { id: true },
  });
  return Boolean(tenant);
}

export async function createTenantSiteConfiguration(args: {
  tenantId: string;
  name: string;
  userId: string;
}) {
  const db = createDbClient();
  const existingTenant = await db.query.siteConfig.findFirst({
    where: eq(siteConfig.tenantId, args.tenantId),
    columns: { id: true },
  });

  if (existingTenant) {
    throw createError({
      statusCode: 409,
      statusMessage: "Tenant already exists",
    });
  }

  const now = new Date();
  const cryptoService = createCryptoService({});
  const clientSecret = uuid();

  await db.insert(siteConfig).values({
    id: uuid(),
    tenantId: args.tenantId,
    name: args.name,
    clientId: uuid(),
    clientSecretEncrypted: cryptoService.encrypt(clientSecret),
    oceanServer: oceanServerValue("ocean"),
    oceanSiteNum: "",
    oceanClientId: "",
    oceanClientSecretEncrypted: "",
    createdAt: now,
    createdBy: args.userId,
    updatedAt: now,
    updatedBy: args.userId,
  });

  const existingMembership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.tenantId, args.tenantId),
      eq(tenantMemberships.userId, args.userId)
    ),
    columns: { id: true },
  });

  if (existingMembership) {
    await db
      .update(tenantMemberships)
      .set({
        role: membershipRoleValue("admin"),
        status: membershipStatusValue("active"),
        updatedAt: now,
        updatedBy: args.userId,
        revokedAt: null,
        revokedBy: null,
      })
      .where(eq(tenantMemberships.id, existingMembership.id));
  } else {
    await db.insert(tenantMemberships).values({
      id: uuid(),
      tenantId: args.tenantId,
      userId: args.userId,
      role: membershipRoleValue("admin"),
      status: membershipStatusValue("active"),
      createdAt: now,
      createdBy: args.userId,
      updatedAt: now,
      updatedBy: args.userId,
    });
  }
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

export async function findInviteForCode(code: string) {
  const db = createDbClient();
  const invite = await db.query.tenantInvites.findFirst({
    where: and(eq(tenantInvites.code, code), gt(tenantInvites.expiresAt, new Date())),
  });
  return invite ?? null;
}
