import type {
  HealthcareService,
  NewHealthcareService,
  UpdateHealthcareService,
} from "@/src/entities/models/healthcare-service";

export interface IHealthcareServicesRepository {
  getAllAtTenant(): Promise<HealthcareService[]>;
  searchByName(name: string): Promise<HealthcareService | null>;
  get(id: string): Promise<HealthcareService | null>;
  create(service: NewHealthcareService): Promise<void>;
  update(service: UpdateHealthcareService): Promise<void>;
  remove(id: string): Promise<void>;
}
