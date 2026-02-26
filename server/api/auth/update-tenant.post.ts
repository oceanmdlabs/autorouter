import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const cxt = await toApplicationContext(event);
  if (cxt.getUser()?.roles.admin !== "system") {
    throw createError({
      statusCode: 403,
      statusMessage: "You are not authorized to update the tenant",
    });
  }
  const body = await readBody(event);
  const tenantId = body.tenantId;
  if (!tenantId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tenant ID is required",
    });
  }
  await replaceUserSession(event, {
    ...session,
    user: {
      ...session.user,
      tenantId,
    },
  });

  return { success: true };
});
