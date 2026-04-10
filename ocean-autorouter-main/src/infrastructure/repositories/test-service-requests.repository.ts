import type { ITestServiceRequestsRepository } from "@/src/application/repositories/test-service-requests.repository.interface";
import type {
  TestServiceRequest,
  NewTestServiceRequest,
  UpdateTestServiceRequest,
} from "@/src/entities/models/test-service-request";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { eq } from "drizzle-orm";
import { testServiceRequests } from "@/drizzle/schema";

export function createTestServiceRequestsRepository({
  cxt,
}: {
  cxt: ApplicationContext;
}): ITestServiceRequestsRepository {
  const dbService = cxt.getDbService();
  return {
    async getAllAtTenant() {
      return (await dbService.findMany(
        testServiceRequests
      )) as TestServiceRequest[];
    },

    async get(id: string): Promise<TestServiceRequest | null> {
      const result = await dbService.findFirst(testServiceRequests, {
        where: eq(testServiceRequests.id, id),
      });
      return result as TestServiceRequest | null;
    },

    async create(record: NewTestServiceRequest) {
      await dbService.insert(
        testServiceRequests,
        dbService.initMetadataAndTenant(record)
      );
    },

    async update(record: UpdateTestServiceRequest) {
      dbService.updateMetadata(record);
      await dbService.update(
        testServiceRequests,
        record,
        eq(testServiceRequests.id, record.id)
      );
    },

    async remove(id) {
      await dbService.delete(
        testServiceRequests,
        eq(testServiceRequests.id, id)
      );
    },
  };
}
