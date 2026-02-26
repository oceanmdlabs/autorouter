import { createCryptoService } from "@/src/infrastructure/services/crypto.service";
import { eventHandler, type H3Event } from "h3";

export default eventHandler(async (event: H3Event) => {
  const authHeader = getHeader(event, "authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring("Bearer ".length);
    const cryptoService = createCryptoService({});

    try {
      const payload = await cryptoService.verifyJWT(token);
      // Add the validated token payload to the event context for use in handlers
      event.context.auth = {
        clientId: payload.clientId,
        tenantId: payload.tenantId,
      };
    } catch (error) {
      throw createError({
        statusCode: 401,
        message: "Invalid or expired token",
      });
    }
  }
});
