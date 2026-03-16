import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const record = await cxt.getErequestsRepository().get(getRouterParam(event, "id")!);

  if (!record) {
    throw createError({
      statusCode: 404,
      statusMessage: "Erequest not found",
    });
  }

  return record;
});
