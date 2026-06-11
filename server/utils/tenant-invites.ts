import { tenantInvites, tenantMemberships } from "@/drizzle/schema";
import type { TenantMembershipRole } from "@/src/entities/models/session";
import { uuid } from "@/src/entities/models/uuid";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { and, desc, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  inviteStatusValue,
  membershipRoleValue,
  membershipStatusValue,
} from "./db-enum-helpers";

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

export type TenantInviteRedemptionState =
  | "pending"
  | "not_found"
  | "redeemed"
  | "revoked"
  | "expired";

export function generateInviteCode() {
  return randomBytes(18).toString("base64url");
}

export function deriveInviteStatus(
  record: { status: string; expiresAt: Date },
  now = Date.now()
): TenantInviteSummary["status"] {
  if (record.status === "pending" && record.expiresAt.getTime() < now) {
    return "expired";
  }
  return record.status as TenantInviteSummary["status"];
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
    status: deriveInviteStatus(record, now),
  }));
}

export async function getTenantInviteRedemptionState(
  code: string
): Promise<TenantInviteRedemptionState> {
  const db = createDbClient();
  const invite = await db.query.tenantInvites.findFirst({
    where: eq(tenantInvites.code, code),
  });

  if (!invite) {
    return "not_found";
  }

  if (invite.status === "revoked") {
    return "revoked";
  }

  if (invite.status === "redeemed") {
    return "redeemed";
  }

  if (invite.status === "expired") {
    return "expired";
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(tenantInvites)
      .set({
        status: inviteStatusValue("expired"),
        updatedBy: "system",
      })
      .where(eq(tenantInvites.id, invite.id));

    return "expired";
  }

  return "pending";
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

export async function findInviteForCode(code: string) {
  const db = createDbClient();
  const invite = await db.query.tenantInvites.findFirst({
    where: and(eq(tenantInvites.code, code), gt(tenantInvites.expiresAt, new Date())),
  });
  return invite ?? null;
}
