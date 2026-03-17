import {
  assertTenantAdmin,
  getTenantMembers,
  updateMembershipRole,
} from "@/server/utils/tenant-access";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";

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

  const currentMembership = (await getTenantMembers(tenantId)).find(
    (member) => member.id === membershipId
  );
  await updateMembershipRole({
    tenantId,
    membershipId,
    role: body.role,
    updatedByUserId: user.id,
  });
  const cxt = await toApplicationContext(event);
  await logPrivacyAuditEvent(cxt, {
    eventType: "tenant_member_role_changed",
    subjectType: "tenant_membership",
    subjectId: membershipId,
    summary: currentMembership
      ? `Changed member role for ${currentMembership.name} to ${body.role}.`
      : `Changed member role to ${body.role}.`,
    sensitiveData: {
      beforeRole: currentMembership?.role ?? null,
      afterRole: body.role,
      targetUserId: currentMembership?.userId ?? null,
      targetName: currentMembership?.name ?? null,
    },
  });

  return { success: true };
});
