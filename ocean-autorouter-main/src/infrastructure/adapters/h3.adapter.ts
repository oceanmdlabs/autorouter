import type { User, UserSessionComposable, UserSession } from "#auth-utils";
import { ApplicationContext } from "@/src/entities/models/application-context";
import {  createLoggerFromEnv } from "@/src/entities/models/logger";
import type { H3Event } from "h3";

export async function toApplicationContext(
  event: H3Event
): Promise<ApplicationContext> {
  const session = await getUserSession(event);
  const auth = event.context.auth;
  let h3User = session.user;
  if (!h3User && auth) {
    h3User = {
      clientId: auth.clientId,
      name: "OAuth2_client_" + auth.clientId,
      tenantId: auth.tenantId,
      roles: { admin: "" },
    };
  }
  return getContext(h3User, session);
}

export function useApplicationContext(session: UserSessionComposable) {
  const h3User = session.user.value;
  return getContext(h3User);
}

function getContext(user?: User | null, h3Session?: UserSession) {
  const logger = createLoggerFromEnv();
  const context = new ApplicationContext(logger);
  if (user) {
    const userId = (
      user?.clientId ??
      user?.googleId ??
      user?.gitHubId ??
      ""
    ).toString();
    context.setSession({
      user:
        userId && user
          ? {
              id: userId,
              name: user.name ?? userId,
              roles: user.roles ?? { admin: "" },
              tenantId: user.tenantId ?? "unknown",
            }
          : null,
      // Pass private key from H3 session if vault is unlocked
      tenantPrivateKey: h3Session?.tenantPrivateKey,
      dekUnlockedAt: h3Session?.dekUnlockedAt,
    });
  }
  return context;
}
