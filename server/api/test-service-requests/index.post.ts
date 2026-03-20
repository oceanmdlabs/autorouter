import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { newTestServiceRequestSchema } from "@/src/entities/models/test-service-request";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);
  try {
    const parsedBody = newTestServiceRequestSchema.parse(body);
    const testServiceRequest = await cxt
      .getTestServiceRequestsRepository()
      .create(parsedBody);
    return testServiceRequest;
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
    });
  }
});
