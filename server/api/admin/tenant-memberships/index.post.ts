import { assertSystemAdminAccess } from "@/server/utils/system-admin-access";
import { assignUserToTenant } from "@/server/utils/tenant-access";
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

  return {
    membership: await assignUserToTenant({
      tenantId: body.tenantId,
      userId: body.userId,
      role: body.role,
      assignedByUserId: user.id,
    }),
  };
});
