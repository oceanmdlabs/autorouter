import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { testServiceRequestUseCase } from "@/src/application/use-cases/test-service-request.use-case";
import { routingEventTypeSchema } from "@/src/entities/models/routing-event-type";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);

  try {
    const results = await testServiceRequestUseCase(cxt)({
      testServiceRequestId: body.testServiceRequestId,
      eventType: routingEventTypeSchema.parse(body.eventType),
    });
    return results;
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
    });
  }
});
