import { hydrateSessionUser } from "@/server/utils/session-user";
import {
  assertActiveMembership,
  isKnownTenant,
} from "@/server/utils/tenant-access";
import { hasSystemAdminAccess } from "@/server/utils/system-admin-access";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const user = session.user;
  if (!user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication is required",
    });
  }

  const body = await readBody(event);
  const tenantId = body.tenantId;
  if (!tenantId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tenant ID is required",
    });
  }

  if (await hasSystemAdminAccess(user)) {
    const knownTenant = await isKnownTenant(tenantId);
    if (!knownTenant) {
      throw createError({
        statusCode: 404,
        statusMessage: "Tenant not found",
      });
    }
  } else {
    await assertActiveMembership({
      tenantId,
      userId: user.id,
    });
  }

  await replaceUserSession(event, {
    ...session,
    user: {
      ...user,
      activeTenantId: tenantId,
      tenantId,
    },
  });

  return {
    success: true,
    user: await hydrateSessionUser({
      ...user,
      activeTenantId: tenantId,
      tenantId,
    }),
  };
});
