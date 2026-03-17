import { hydrateSessionUser } from "@/server/utils/session-user";
import { redeemTenantInvite } from "@/server/utils/tenant-access";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";

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
  if (!body.code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invite code is required",
    });
  }

  const invite = await redeemTenantInvite({
    code: body.code,
    userId: user.id,
  });

  await replaceUserSession(event, {
    ...session,
    user: {
      ...user,
      activeTenantId: invite.tenantId,
      tenantId: invite.tenantId,
    },
  });
  const cxt = await toApplicationContext(event);
  await logPrivacyAuditEvent(cxt, {
    eventType: "tenant_invite_redeemed",
    subjectType: "tenant_invite",
    subjectId: invite.id,
    summary: `Redeemed ${invite.role} invite.`,
    sensitiveData: {
      role: invite.role,
      tenantId: invite.tenantId,
    },
  });

  return {
    success: true,
    tenantId: invite.tenantId,
    user: await hydrateSessionUser({
      ...user,
      activeTenantId: invite.tenantId,
      tenantId: invite.tenantId,
    }),
  };
});
