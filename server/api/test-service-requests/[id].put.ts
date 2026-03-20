import { updateTestServiceRequestSchema } from "@/src/entities/models/test-service-request";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing test service request id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    const parsedBody = updateTestServiceRequestSchema.parse({ ...body, id });
    await cxt.getTestServiceRequestsRepository().update(parsedBody);

    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
    });
  }
});
