import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing routing rule id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    await cxt.getRoutingRulesRepository().remove(id);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
    });
  }
});
