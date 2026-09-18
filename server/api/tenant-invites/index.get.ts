import { getTenantInvites } from "@/server/utils/tenant-invites";
import { assertTenantAdmin } from "@/server/utils/tenant-memberships";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const user = session.user;
  const tenantId = user?.activeTenantId ?? user?.tenantId;

  if (!user?.id || !tenantId) {
    throw createError({
      statusCode: 401,
      statusMessage: "An active tenant is required",
    });
  }

  if (user.roles.admin !== "system") {
    await assertTenantAdmin({
      tenantId,
      userId: user.id,
    });
  }

  return {
    invites: await getTenantInvites(tenantId),
  };
});
