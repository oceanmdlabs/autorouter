import { buildSessionUserFromIdentity } from "@/server/utils/session-user";

export default defineOAuthGoogleEventHandler({
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
