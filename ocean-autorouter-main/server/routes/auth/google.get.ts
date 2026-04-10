import {getRoles} from "./roles";

export default defineOAuthGoogleEventHandler({
    config: {
        redirectURL: (process.env.URL ?? "http://localhost:4000") + "/auth/google",
    } satisfies OAuthGoogleConfig,
    async onSuccess(event, {user}) {

        await setUserSession(event, {
            user: {
                name: user.name + " (Google)",
                googleId: user.sub,
                tenantId: user.tenantId ?? user.sub,
                roles: getRoles("google", user),
            },
        });

        return sendRedirect(event, "/portal");
    },
    // Optional, will return a json error and 401 status code by default
    onError(event, error) {
        console.error("Google OAuth error:", error);
        return sendRedirect(event, "/error");
    },
});
