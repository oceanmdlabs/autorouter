// user is the user object from the auth provider:

export function getRoles(
  identityProvider: "google" | "github",
  user: { sub: string }
): {
  admin: "" | "tenant" | "system";
} {
  if (
    identityProvider === process.env.SYSTEM_ADMIN_IDENTITY_PROVIDER &&
    user.sub &&
    process.env.SYSTEM_ADMIN_USER_ID?.split(",").includes(user.sub)
  ) {
    return { admin: "system" };
  }
  return { admin: "tenant" };
}
