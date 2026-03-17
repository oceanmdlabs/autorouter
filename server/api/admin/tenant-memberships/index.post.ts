import { assertSystemAdminAccess } from "@/server/utils/system-admin-access";
import { assignUserToTenant } from "@/server/utils/tenant-access";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";
import { z } from "zod";

const bodySchema = z.object({
  tenantId: z.string().trim().min(1, "Tenant ID is required").max(255),
  userId: z.string().uuid("A valid user ID is required"),
  role: z.enum(["admin", "member"]).default("member"),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const user = session.user;

  if (!user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication is required",
    });
  }

  await assertSystemAdminAccess(user);

  const body = bodySchema.parse(await readBody(event));

  const membership = await assignUserToTenant({
    tenantId: body.tenantId,
    userId: body.userId,
    role: body.role,
    assignedByUserId: user.id,
  });

  const cxt = await toApplicationContext(event);
  await logPrivacyAuditEvent(cxt, {
    tenantId: body.tenantId,
    eventType: "tenant_member_assigned",
    subjectType: "tenant_membership",
    subjectId: membership.id,
    summary: `Assigned user to tenant with ${body.role} access.`,
    sensitiveData: {
      targetUserId: body.userId,
      role: body.role,
      tenantId: body.tenantId,
    },
  });

  return { membership };
});
