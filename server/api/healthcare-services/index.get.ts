import type { HealthcareService } from "@/src/entities/models/healthcare-service";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(
  async (event): Promise<HealthcareService[]> => {
    const cxt = await toApplicationContext(event);

    try {
      const services = await cxt
        .getHealthcareServicesRepository()
        .getAllAtTenant();
      return services;
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        message: error.message,
      });
    }
  }
);
