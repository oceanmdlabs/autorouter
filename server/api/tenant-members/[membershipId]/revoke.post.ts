import {
  assertTenantAdmin,
  getTenantMembers,
  revokeMembership,
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
  if (!membershipId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Membership ID is required",
    });
  }

  const currentMembership = (await getTenantMembers(tenantId)).find(
    (member) => member.id === membershipId
  );
  await revokeMembership({
    tenantId,
    membershipId,
    revokedByUserId: user.id,
  });
  const cxt = await toApplicationContext(event);
  await logPrivacyAuditEvent(cxt, {
    eventType: "tenant_member_revoked",
    subjectType: "tenant_membership",
    subjectId: membershipId,
    summary: currentMembership
      ? `Revoked member access for ${currentMembership.name}.`
      : "Revoked member access.",
    sensitiveData: {
      targetUserId: currentMembership?.userId ?? null,
      targetName: currentMembership?.name ?? null,
      previousRole: currentMembership?.role ?? null,
    },
  });

  return { success: true };
});
