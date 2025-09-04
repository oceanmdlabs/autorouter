import type { ITestServiceRequestsRepository } from "@/src/application/repositories/test-service-requests.repository.interface";
import type {
  TestServiceRequest,
  NewTestServiceRequest,
  UpdateTestServiceRequest,
} from "@/src/entities/models/test-service-request";
import { ApplicationContext } from "@/src/entities/models/application-context";
import { eq } from "drizzle-orm";
import { testServiceRequests } from "@/drizzle/schema";

export function createTestServiceRequestsRepository({
  cxt,
}: {
  cxt: ApplicationContext;
}): ITestServiceRequestsRepository {
  const db = cxt.getDbService().getDb();
  return {
    async getAllAtTenant() {
      return (await db.query.testServiceRequests.findMany({
        where: eq(testServiceRequests.tenantId, cxt.getNonEmptyTenantId()),
      })) as TestServiceRequest[];
    },

    async get(id: string): Promise<TestServiceRequest | null> {
      const result = (await db.query.testServiceRequests.findFirst({
        where: eq(testServiceRequests.id, id),
      })) as TestServiceRequest | null;
      return result;
    },

    async create(record: NewTestServiceRequest) {
      await db
        .insert(testServiceRequests)
        .values(cxt.getDbService().initMetadataAndTenant(record));
    },

    async update(record: UpdateTestServiceRequest) {
      cxt.getDbService().updateMetadata(record);
      await db
        .update(testServiceRequests)
        .set(record)
        .where(eq(testServiceRequests.id, record.id));
    },

    async remove(id) {
      await db
        .delete(testServiceRequests)
        .where(eq(testServiceRequests.id, id));
    },
  };
}
