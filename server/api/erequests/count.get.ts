import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);

  return {
    total: await cxt.getErequestsRepository().count(),
  };
});
