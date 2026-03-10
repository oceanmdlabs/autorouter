import { hydrateSessionUser } from "@/server/utils/session-user";

export default defineNitroPlugin(() => {
  // Called when the session is fetched during SSR for the Vue composable (/api/_auth/session)
  // Or when we call useUserSession().fetch()
  sessionHooks.hook("fetch", async (session) => {
    session.user = await hydrateSessionUser(session.user);
  });

  // Called when we call useUserSession().clear() or clearUserSession(event)
  sessionHooks.hook("clear", async () => {
    // Log that user logged out
    console.info("logged out");
  });
});
