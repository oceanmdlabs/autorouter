import { assertSystemAdminAccess } from "@/server/utils/system-admin-access";
import { listActiveSystemUsers } from "@/server/utils/tenant-access";
import { z } from "zod";

const querySchema = z.object({
  search: z.string().trim().optional(),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  await assertSystemAdminAccess(session.user);

  const query = querySchema.parse(getQuery(event));

  return {
    users: await listActiveSystemUsers({
      search: query.search,
    }),
  };
});
