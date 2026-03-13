import { hydrateSessionUser } from "@/server/utils/session-user";
import { assertSystemAdminAccess } from "@/server/utils/system-admin-access";
import { createTenantSiteConfiguration } from "@/server/utils/tenant-access";
import { z } from "zod";

const createTenantSchema = z.object({
  tenantId: z
    .string()
    .trim()
    .min(1, "Tenant ID is required")
    .max(255)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i, "Use letters, numbers, and hyphens only"),
  name: z.string().trim().min(1, "Site name is required").max(255),
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

  const body = createTenantSchema.parse(await readBody(event));
  const tenantId = body.tenantId.trim();

  await createTenantSiteConfiguration({
    tenantId,
    name: body.name.trim(),
    userId: user.id,
  });

  await replaceUserSession(event, {
    ...session,
    user: {
      ...user,
      activeTenantId: tenantId,
      tenantId,
    },
  });

  return {
    success: true,
    tenantId,
    user: await hydrateSessionUser({
      ...user,
      activeTenantId: tenantId,
      tenantId,
    }),
  };
});
