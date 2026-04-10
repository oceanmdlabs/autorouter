import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  await cxt.getActivityLogEntriesRepository().removeAll();
  return { success: true };
});
