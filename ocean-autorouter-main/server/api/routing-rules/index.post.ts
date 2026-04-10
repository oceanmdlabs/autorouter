import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { newRoutingRuleSchema } from "@/src/entities/models/routing-rule";
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);

  try {
    const parsedBody = newRoutingRuleSchema.parse(body);
    await cxt.getRoutingRulesRepository().create(parsedBody);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,

      data: error.errors,
    });
  }
});
