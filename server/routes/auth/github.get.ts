import { buildSessionUserFromIdentity } from "@/server/utils/session-user";
export default defineOAuthGitHubEventHandler({
  config: {
    emailRequired: true,
    clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID,
    clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET,
  } satisfies OAuthGitHubConfig,
  async onSuccess(event, { user }) {
    await setUserSession(event, {
      user: await buildSessionUserFromIdentity({
        provider: "github",
        subject: user.id.toString(),
        displayName: `${user.login} (GitHub)`,
      }),
    });
    return sendRedirect(event, "/portal");
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error("GitHub OAuth error:", error);
    return sendRedirect(event, "/");
  },
});
