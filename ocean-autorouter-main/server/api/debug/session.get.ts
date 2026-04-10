export default defineEventHandler(async (event) => {
    const session = await getUserSession(event);
    return {
        hasSession: !!session,
        session: session,
        cookies: parseCookies(event),
        headers: getHeaders(event),
        url: getRequestURL(event).toString(),
        timestamp: new Date().toISOString()
    };
});
