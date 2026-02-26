import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing test service request id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    const testServiceRequest = await cxt
      .getTestServiceRequestsRepository()
      .get(id);
    return testServiceRequest;
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
    });
  }
});
