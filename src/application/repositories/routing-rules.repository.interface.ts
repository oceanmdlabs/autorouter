import type {
  NewRoutingRule,
  RoutingRule,
} from "@/src/entities/models/routing-rule";

export interface IRoutingRulesRepository {
  getAllAtTenant(): Promise<RoutingRule[]>;
  get(id: string): Promise<RoutingRule | null>;
  create(service: NewRoutingRule): Promise<void>;
  update(service: Partial<RoutingRule> & { id: string }): Promise<void>;
  remove(id: string): Promise<void>;
}
