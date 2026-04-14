import type { User } from "#auth-utils";
import type { H3Event } from "h3";
import { deleteCookie, getCookie } from "h3";
import {
  PENDING_INVITE_CODE_COOKIE,
  getInviteAuthStatusMessage,
} from "@/shared/invite-access";
import {
  ensureLegacyMembership,
  getTenantInviteRedemptionState,
  getMembershipsForUser,
  getUserById,
  resolveActiveTenantId,
  upsertOAuthUser,
  type IdentityProvider,
  type UserIdentity,
} from "./tenant-access";
import { isSystemAdmin } from "../routes/auth/system-admin";

function getIdentityFromSessionUser(user: Partial<User> | null | undefined):
  | UserIdentity
  | null {
  if (!user) {
    return null;
  }

  const provider =
    user.provider ??
    (user.googleId ? "google" : undefined) ??
    (user.gitHubId ? "github" : undefined);
  const subject = user.subject ?? user.googleId ?? user.gitHubId;

  if (!provider || !subject) {
    return null;
  }

  return {
    provider,
    subject,
    displayName: user.name ?? subject,
  };
}

export async function buildSessionUserFromIdentity(identity: UserIdentity) {
  const dbUser = await upsertOAuthUser(identity);
  if (!dbUser) {
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to load authenticated user",
    });
  }
  const memberships = await ensureLegacyMembership(identity, dbUser.id);
  const systemAdmin = await isSystemAdmin(identity.provider, identity.subject);
  const activeTenantId = resolveActiveTenantId({
    requestedTenantId: null,
    memberships,
    isSystemAdmin: systemAdmin,
  });

  return {
    id: dbUser.id,
    name: dbUser.displayName,
    provider: identity.provider,
    subject: identity.subject,
    googleId: identity.provider === "google" ? identity.subject : undefined,
    gitHubId: identity.provider === "github" ? identity.subject : undefined,
    roles: { admin: systemAdmin ? "system" : "tenant" },
    activeTenantId,
    tenantId: activeTenantId,
    memberships,
  } satisfies User;
}

function hasActiveMembership(user: Pick<User, "memberships" | "roles">) {
  return (
    user.roles.admin === "system" ||
    user.memberships.some((membership) => membership.status === "active")
  );
}

async function assertSessionAccess(event: H3Event, sessionUser: User) {
  if (hasActiveMembership(sessionUser)) {
    return;
  }

  const pendingInviteCode = getCookie(event, PENDING_INVITE_CODE_COOKIE)?.trim();
  if (!pendingInviteCode) {
    throw createError({
      statusCode: 403,
      statusMessage: getInviteAuthStatusMessage("invite-required"),
    });
  }

  const inviteState = await getTenantInviteRedemptionState(pendingInviteCode);
  if (inviteState === "pending") {
    return;
  }

  deleteCookie(event, PENDING_INVITE_CODE_COOKIE);

  const reasonByState = {
    not_found: "invite-not-found",
    redeemed: "invite-redeemed",
    revoked: "invite-revoked",
    expired: "invite-expired",
  } as const;

  throw createError({
    statusCode: 403,
    statusMessage: getInviteAuthStatusMessage(reasonByState[inviteState]),
  });
}

export async function buildAuthorizedSessionUserFromIdentity(
  event: H3Event,
  identity: UserIdentity
) {
  const sessionUser = await buildSessionUserFromIdentity(identity);
  await assertSessionAccess(event, sessionUser);
  return sessionUser;
}

export async function hydrateSessionUser(
  sessionUser: Partial<User> | null | undefined
) {
  const identity = getIdentityFromSessionUser(sessionUser);
  const requestedTenantId =
    sessionUser?.activeTenantId ?? sessionUser?.tenantId ?? null;

  let dbUser = sessionUser?.id ? await getUserById(sessionUser.id) : null;
  if (!dbUser && identity) {
    dbUser = await upsertOAuthUser(identity);
  }

  if (!dbUser) {
    return null;
  }

  const memberships = identity
    ? await ensureLegacyMembership(identity, dbUser.id)
    : await getMembershipsForUser(dbUser.id);
  const provider = (identity?.provider ??
    dbUser.provider ??
    sessionUser?.provider) as IdentityProvider | undefined;
  const subject = identity?.subject ?? dbUser.subject ?? sessionUser?.subject;
  const systemAdmin =
    provider && subject ? await isSystemAdmin(provider, subject) : false;
  const activeTenantId = resolveActiveTenantId({
    requestedTenantId,
    memberships,
    isSystemAdmin: systemAdmin,
  });

  return {
    id: dbUser.id,
    name: dbUser.displayName,
    provider,
    subject: subject ?? undefined,
    googleId: provider === "google" ? subject : undefined,
    gitHubId: provider === "github" ? subject : undefined,
    roles: { admin: systemAdmin ? "system" : "tenant" },
    activeTenantId,
    tenantId: activeTenantId,
    memberships,
  } satisfies User;
}
