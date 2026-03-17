import {
  assertTenantAdmin,
  getTenantInvites,
  revokeTenantInvite,
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

  const inviteId = getRouterParam(event, "inviteId");
  if (!inviteId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invite ID is required",
    });
  }

  const invite = (await getTenantInvites(tenantId)).find(
    (record) => record.id === inviteId
  );
  await revokeTenantInvite({
    tenantId,
    inviteId,
    revokedByUserId: user.id,
  });
  const cxt = await toApplicationContext(event);
  await logPrivacyAuditEvent(cxt, {
    eventType: "tenant_invite_revoked",
    subjectType: "tenant_invite",
    subjectId: inviteId,
    summary: invite
      ? `Revoked ${invite.role} invite.`
      : "Revoked tenant invite.",
    sensitiveData: invite
      ? {
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
        }
      : null,
  });

  return { success: true };
});
