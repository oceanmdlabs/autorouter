import {
  assertTenantAdmin,
  updateMembershipRole,
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

  const membershipId = getRouterParam(event, "membershipId");
  const body = await readBody(event);
  if (!membershipId || (body.role !== "admin" && body.role !== "member")) {
    throw createError({
      statusCode: 400,
      statusMessage: "A valid membership role is required",
    });
  }

  await updateMembershipRole({
    tenantId,
    membershipId,
    role: body.role,
    updatedByUserId: user.id,
  });

  return { success: true };
});
