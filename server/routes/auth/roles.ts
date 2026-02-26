import { type IdentityProvider, isSystemAdmin } from "./system-admin";

export async function getRoles(
  identityProvider: IdentityProvider,
  user: { sub: string }
): Promise<{
  admin: "" | "tenant" | "system";
}> {
  if (await isSystemAdmin(identityProvider, user.sub)) {
    return { admin: "system" };
  }
  return { admin: "tenant" };
}
