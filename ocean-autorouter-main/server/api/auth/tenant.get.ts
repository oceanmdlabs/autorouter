import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { UserData } from "@/src/entities/models/auth";

export default defineEventHandler(async (event): Promise<UserData> => {
  const cxt = await toApplicationContext(event);
  const user = cxt.getUser();

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    });
  }

  return { tenantId: user.tenantId, roles: user.roles };
});