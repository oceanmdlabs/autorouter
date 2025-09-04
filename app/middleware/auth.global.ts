export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  if (!loggedIn.value) {
    if (to.path.startsWith("/portal")) {
      console.info("Session expired in portal. Redirecting to login.");
      return navigateTo("/login");
    }
  }
});
