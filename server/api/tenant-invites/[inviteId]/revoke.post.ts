import {
  assertTenantAdmin,
  revokeTenantInvite,
} from "@/server/utils/tenant-access";

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

  const inviteId = getRouterParam(event, "inviteId");
  if (!inviteId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invite ID is required",
    });
  }

  await revokeTenantInvite({
    tenantId,
    inviteId,
    revokedByUserId: user.id,
  });

  return { success: true };
});
