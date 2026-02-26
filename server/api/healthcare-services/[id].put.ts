import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { updateHealthcareServiceSchema } from "@/src/entities/models/healthcare-service";
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing healthcare service id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    const parsedBody = updateHealthcareServiceSchema.parse({ ...body, id });
    await cxt.getHealthcareServicesRepository().update(parsedBody);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
    });
  }
});
