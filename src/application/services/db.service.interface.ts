import type {
  BaseResource,
  NewBaseResource,
  TenantConfined,
} from "@/src/entities/models/base";
import type { FhirData } from "@/src/entities/models/resource";
import type { SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";

export interface IDbService {
  initMetadata<T>(resource: T): T & BaseResource;
  initMetadataAndTenant<T>(resource: T): T & BaseResource & TenantConfined;
  updateMetadata(resource: Partial<BaseResource>): void;
  findExistingResourceBasedOnIdOrIdentifier<
    T extends NewBaseResource & { content: FhirData }
  >(
    resource: T,
    table: { findFirst: (criteria: { with?: any; where?: any }) => any }
  ): Promise<T | null>;
  findMany<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options?: {
      where?: SQL<unknown>;
      orderBy?: any;
      limit?: number;
      offset?: number;
    }
  ): Promise<any[]>;
  findFirst<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options?: { where?: SQL<unknown> }
  ): Promise<any | null>;
  insert<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: any
  ): Promise<void>;
  update<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: any,
    where: SQL<unknown>
  ): Promise<void>;
  delete<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    where: SQL<unknown>
  ): Promise<void>;
  count<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options?: { where?: SQL<unknown> }
  ): Promise<number>;
}
