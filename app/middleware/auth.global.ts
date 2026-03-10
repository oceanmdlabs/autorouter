export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession();
  if (!loggedIn.value) {
    if (to.path.startsWith("/portal")) {
      console.info("Session expired in portal. Redirecting to login.");
      return navigateTo("/login");
    }
  }

  const activeTenantId = user.value?.activeTenantId ?? user.value?.tenantId ?? null
  if (
    loggedIn.value &&
    to.path.startsWith('/portal') &&
    to.path !== '/portal/access' &&
    !activeTenantId
  ) {
    return navigateTo('/portal/access')
  }
});
