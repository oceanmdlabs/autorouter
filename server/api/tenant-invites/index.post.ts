import {
  assertTenantAdmin,
  createTenantInvite,
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

  const body = await readBody(event);
  const daysUntilExpiry = Number(body.daysUntilExpiry ?? 7);
  const role = body.role === "admin" ? "admin" : "member";
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Math.max(1, Math.min(daysUntilExpiry, 30)));

  const invite = await createTenantInvite({
    tenantId,
    invitedByUserId: user.id,
    role,
    expiresAt,
  });
  const cxt = await toApplicationContext(event);
  await logPrivacyAuditEvent(cxt, {
    eventType: "tenant_invite_created",
    subjectType: "tenant_invite",
    subjectId: invite.id,
    summary: `Created ${role} invite expiring on ${expiresAt.toISOString()}.`,
    sensitiveData: {
      role,
      expiresAt: expiresAt.toISOString(),
    },
  });

  const appUrl = process.env.HOST_URL ?? process.env.URL ?? "http://localhost:4000";

  return {
    invite: {
      ...invite,
      redeemUrl: `${appUrl}/invite/${invite.code}`,
    },
  };
});
