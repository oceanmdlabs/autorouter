import type { SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgColumn, PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import type * as schema from "@/drizzle/schema";
import type { BaseResource, TenantConfined } from "@/src/entities/models/base";
export type DbType = NodePgDatabase<typeof schema>;

export interface QueryOptions {
  where?: SQL<unknown>;
  orderBy?: SQL<unknown>;
  limit?: number;
  offset?: number;
}

export interface IDbService {
  initMetadata<T>(resource: T): T & BaseResource;
  initMetadataAndTenant<T>(resource: T): T & BaseResource & TenantConfined;
  updateMetadata(resource: Partial<BaseResource>): void;
  getSiteFilter<T extends { tenantId: PgColumn }>(
    table: T
  ): SQL<unknown> | undefined;
  withSiteFilter<T extends { tenantId: PgColumn }>(
    table: T,
    existingWhere?: SQL<unknown>
  ): SQL<unknown> | undefined;

  // Methods with automatic site filtering (for site-aware tables)
  findMany<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options?: QueryOptions
  ): Promise<Array<T["$inferSelect"]>>;

  findFirst<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options?: QueryOptions
  ): Promise<T["$inferSelect"] | null>;

  update<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: Record<string, unknown>,
    where: SQL<unknown>
  ): Promise<void>;

  delete<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    where: SQL<unknown>
  ): Promise<void>;

  insert<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: PgInsertValue<T>
  ): Promise<void>;

  count<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options?: { where?: SQL<unknown> }
  ): Promise<number>;

  // Methods without site filtering (for global tables)
  findManyGlobal<T extends PgTable>(
    table: T,
    options?: QueryOptions
  ): Promise<Array<T["$inferSelect"]>>;

  findFirstGlobal<T extends PgTable>(
    table: T,
    options?: QueryOptions
  ): Promise<T["$inferSelect"] | null>;

  updateGlobal<T extends PgTable>(
    table: T,
    values: Record<string, unknown>,
    where: SQL<unknown>
  ): Promise<void>;

  deleteGlobal<T extends PgTable>(table: T, where: SQL<unknown>): Promise<void>;

  insertGlobal<T extends PgTable>(
    table: T,
    values: PgInsertValue<T>
  ): Promise<void>;

  insertGlobalReturning<T extends PgTable>(
    table: T,
    values: PgInsertValue<T>
  ): Promise<T["$inferSelect"]>;

  insertGlobalReturningMany<T extends PgTable>(
    table: T,
    values: PgInsertValue<T>[]
  ): Promise<T["$inferSelect"][]>;

  countGlobal<T extends PgTable>(
    table: T,
    where?: SQL<unknown>
  ): Promise<number>;
}
