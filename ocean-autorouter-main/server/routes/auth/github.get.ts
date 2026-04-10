import { getRoles } from "./roles";
export default defineOAuthGitHubEventHandler({
  config: {
    emailRequired: true,
    clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID,
    clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET,
  } satisfies OAuthGitHubConfig,
  async onSuccess(event, { user }) {
    await setUserSession(event, {
      user: {
        name: user.login + " (GitHub)",
        gitHubId: user.id.toString(),
        tenantId: "github" + user.id.toString(),
        roles: getRoles("github", { sub: user.id.toString() }),
      },
    });
    return sendRedirect(event, "/portal");
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error("GitHub OAuth error:", error);
    return sendRedirect(event, "/");
  },
});
