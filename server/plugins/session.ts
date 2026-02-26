export default defineNitroPlugin(() => {
  // Called when the session is fetched during SSR for the Vue composable (/api/_auth/session)
  // Or when we call useUserSession().fetch()
  sessionHooks.hook("fetch", async (session, event) => {
    // console.info("session could be extended here e.g. with a database call");
    // extend User Session by calling your database
    // or
    // throw createError({ ... }) if session is invalid for example
  });

  // Called when we call useUserSession().clear() or clearUserSession(event)
  sessionHooks.hook("clear", async (session, event) => {
    // Log that user logged out
    console.info("logged out");
  });
});
