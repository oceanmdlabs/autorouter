import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { z } from "zod";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);

  try {
    const { orderedIds } = reorderSchema.parse(body);
    await cxt.getRoutingRulesRepository().reorder(orderedIds);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
    });
  }
});
