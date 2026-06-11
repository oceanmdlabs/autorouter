import { identityProviderEnum, tenantMemberships, users } from "@/drizzle/schema";
import type { TenantMembershipRole } from "@/src/entities/models/session";
import { uuid } from "@/src/entities/models/uuid";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { and, asc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { eqEnum, identityProviderValue } from "./db-enum-helpers";

export type IdentityProvider = (typeof identityProviderEnum.enumValues)[number];

export interface UserIdentity {
  provider: IdentityProvider;
  subject: string;
  displayName: string;
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
