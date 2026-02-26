import type {
  NewTestServiceRequest,
  TestServiceRequest,
  UpdateTestServiceRequest,
} from "@/src/entities/models/test-service-request";

export interface ITestServiceRequestsRepository {
  getAllAtTenant(): Promise<TestServiceRequest[]>;
  get(id: string): Promise<TestServiceRequest | null>;
  create(testServiceRequest: NewTestServiceRequest): Promise<void>;
  update(testServiceRequest: UpdateTestServiceRequest): Promise<void>;
  remove(id: string): Promise<void>;
}
