import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { TestServiceRequest } from "@/src/entities/models/test-service-request";
export default defineEventHandler(
  async (event): Promise<TestServiceRequest[]> => {
    const cxt = await toApplicationContext(event);

    try {
      const testServiceRequests = await cxt
        .getTestServiceRequestsRepository()
        .getAllAtTenant();
      return testServiceRequests;
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        message: error.message,
      });
    }
  }
);
