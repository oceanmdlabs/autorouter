import { buildAuthorizedSessionUserFromIdentity } from "@/server/utils/session-user";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";
import {
  buildAuthErrorRedirect,
  withDatabaseResumeRetry,
} from "@/server/utils/auth-flow-errors";

export default defineOAuthGitHubEventHandler({
  config: {
    emailRequired: true,
    clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID,
    clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET,
  } satisfies OAuthGitHubConfig,
  async onSuccess(event, { user }) {
    try {
      const sessionUser = await withDatabaseResumeRetry(() =>
        buildAuthorizedSessionUserFromIdentity(event, {
          provider: "github",
          subject: user.id.toString(),
          displayName: `${user.login} (GitHub)`,
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
          summary: "User logged in with GitHub OAuth.",
        })
      );
      return sendRedirect(event, "/portal");
    } catch (error) {
      console.error("GitHub OAuth success handler error:", error);
      return sendRedirect(
        event,
        buildAuthErrorRedirect({ provider: "github", error })
      );
    }
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error("GitHub OAuth error:", error);
    return sendRedirect(
      event,
      buildAuthErrorRedirect({ provider: "github", error })
    );
  },
});
