import type {
  BaseResource,
  NewBaseResource,
  TenantConfined,
} from "@/src/entities/models/base";
import type { FhirData } from "@/src/entities/models/resource";
import type * as schema from "@/drizzle/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
export type DbType = NodePgDatabase<typeof schema>;

export interface IDbService {
  getDb(): DbType;
  initMetadata<T>(resource: T): T & BaseResource;
  initMetadataAndTenant<T>(resource: T): T & BaseResource & TenantConfined;
  updateMetadata(resource: Partial<BaseResource>): void;
  findExistingResourceBasedOnIdOrIdentifier<
    T extends NewBaseResource & { content: FhirData }
  >(
    resource: T,
    table: { findFirst: (criteria: { with?: any; where?: any }) => any }
  ): Promise<T | null>;
}
