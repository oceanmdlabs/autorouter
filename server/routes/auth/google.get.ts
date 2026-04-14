import { buildAuthorizedSessionUserFromIdentity } from "@/server/utils/session-user";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";
import {
  buildAuthErrorRedirect,
  withDatabaseResumeRetry,
} from "@/server/utils/auth-flow-errors";

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    try {
      const sessionUser = await withDatabaseResumeRetry(() =>
        buildAuthorizedSessionUserFromIdentity(event, {
          provider: "google",
          subject: user.sub,
          displayName: `${user.name} (Google)`,
        })
      );
      await setUserSession(event, {
        user: sessionUser,
      });
      const cxt = await toApplicationContext(event);
      await withDatabaseResumeRetry(() =>
        logPrivacyAuditEvent(cxt, {
          eventType: "login_succeeded",
          subjectType: "tenant",
          subjectId: sessionUser.activeTenantId,
          summary: "User logged in with Google OAuth.",
        })
      );
      return sendRedirect(event, "/portal");
    } catch (error) {
      console.error("Google OAuth success handler error:", error);
      return sendRedirect(
        event,
        buildAuthErrorRedirect({ provider: "google", error })
      );
    }
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error("Google OAuth error:", error);
    return sendRedirect(
      event,
      buildAuthErrorRedirect({ provider: "google", error })
    );
  },
});
