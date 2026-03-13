import type { User } from "#auth-utils";
import { isSystemAdmin } from "@/server/routes/auth/system-admin";

export async function hasSystemAdminAccess(
  user: Partial<User> | null | undefined
): Promise<boolean> {
  if (!user) {
    return false;
  }

  if (user.roles?.admin === "system") {
    return true;
  }

  const provider = user.provider;
  const subject = user.subject ?? user.googleId ?? user.gitHubId;

  if (!provider || !subject) {
    return false;
  }

  return await isSystemAdmin(provider, subject);
}

export async function assertSystemAdminAccess(
  user: Partial<User> | null | undefined
) {
  if (await hasSystemAdminAccess(user)) {
    return;
  }

  throw createError({
    statusCode: 403,
    statusMessage: "You are not authorized to access this resource",
  });
}
