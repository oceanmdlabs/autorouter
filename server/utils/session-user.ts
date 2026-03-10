import type { User } from "#auth-utils";
import {
  ensureLegacyMembership,
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
