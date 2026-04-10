export default defineNuxtRouteMiddleware((to) => {
    const userSession = useUserSession();
    const {loggedIn} = userSession;

    if (!loggedIn.value) {
        if (to.path.startsWith("/portal")) {
            console.info("auth.global.ts: Session expired in portal. Redirecting to login.");
            return navigateTo("/login");
        }
    }
});
