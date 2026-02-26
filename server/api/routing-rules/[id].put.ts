import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { updateRoutingRuleSchema } from "@/src/entities/models/routing-rule";
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing routing rule id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    const parsedBody = updateRoutingRuleSchema.parse({ ...body, id });
    await cxt.getRoutingRulesRepository().update(parsedBody);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,

      data: error.errors,
    });
  }
});
