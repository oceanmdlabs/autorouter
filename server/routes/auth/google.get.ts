import { buildSessionUserFromIdentity } from "@/server/utils/session-user";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    const sessionUser = await buildSessionUserFromIdentity({
      provider: "google",
      subject: user.sub,
      displayName: `${user.name} (Google)`,
    });
    await setUserSession(event, {
      user: sessionUser,
    });
    const cxt = await toApplicationContext(event);
    await logPrivacyAuditEvent(cxt, {
      eventType: "login_succeeded",
      subjectType: "tenant",
      subjectId: sessionUser.activeTenantId,
      summary: "User logged in with Google OAuth.",
    });
    return sendRedirect(event, "/portal");
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error("Google OAuth error:", error);
    return sendRedirect(event, "/error");
  },
});
