import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { newHealthcareServiceSchema } from "@/src/entities/models/healthcare-service";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);

  try {
    const parsedBody = newHealthcareServiceSchema.parse(body);
    const service = await cxt
      .getHealthcareServicesRepository()
      .create(parsedBody);
    return service;
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
    });
  }
});
