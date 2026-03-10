import type { User, UserSessionComposable } from "#auth-utils";
import { ApplicationContext } from "@/src/entities/models/application-context";
import { DefaultLogger } from "@/src/entities/models/logger";
import type { H3Event } from "h3";

export async function toApplicationContext(
  event: H3Event
): Promise<ApplicationContext> {
  const session = await getUserSession(event);
  const auth = event.context.auth;
  let h3User = session.user;
  if (!h3User && auth) {
    h3User = {
      id: auth.clientId,
      clientId: auth.clientId,
      name: "OAuth2_client_" + auth.clientId,
      activeTenantId: auth.tenantId,
      tenantId: auth.tenantId,
      roles: { admin: "" },
      memberships: [],
    };
  }
  return getContext(h3User);
}

export function useApplicationContext(session: UserSessionComposable) {
  const h3User = session.user.value;
  return getContext(h3User);
}

function getContext(user?: User | null) {
  const logger = new DefaultLogger();
  const context = new ApplicationContext(logger);
  if (user) {
    const userId = (user?.id ?? user?.clientId ?? "").toString();
    context.setSession({
      user:
        userId && user
          ? {
              id: userId,
              name: user.name ?? userId,
              provider: user.provider,
              subject: user.subject,
              roles: user.roles ?? { admin: "" },
              activeTenantId: user.activeTenantId ?? user.tenantId ?? null,
              tenantId: user.activeTenantId ?? user.tenantId ?? null,
              memberships: user.memberships ?? [],
            }
          : null,
    });
  }
  return context;
}
