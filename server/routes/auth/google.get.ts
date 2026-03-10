import { buildSessionUserFromIdentity } from "@/server/utils/session-user";

export default defineOAuthGoogleEventHandler({
  config: {
    redirectURL: (process.env.URL ?? "http://localhost:4000") + "/auth/google",
  } satisfies OAuthGoogleConfig,
  async onSuccess(event, { user }) {
    await setUserSession(event, {
      user: await buildSessionUserFromIdentity({
        provider: "google",
        subject: user.sub,
        displayName: `${user.name} (Google)`,
      }),
    });
    return sendRedirect(event, "/portal");
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error("Google OAuth error:", error);
    return sendRedirect(event, "/error");
  },
});
