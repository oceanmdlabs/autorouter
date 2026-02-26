import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing healthcare service id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    const service = await cxt.getHealthcareServicesRepository().get(id);
    return service;
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
    });
  }
});
