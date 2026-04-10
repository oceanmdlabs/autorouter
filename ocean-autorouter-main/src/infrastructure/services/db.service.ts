import * as schema from "@/drizzle/schema";
import type {
  IDbService,
  QueryOptions
} from "@/src/application/services/db.service.interface";
import { AppInitializationError } from "@/src/entities/errors/common";
import { ApplicationContext } from "@/src/entities/models/application-context";
import {
  isTenantConfined,
  type BaseResource,
  type TenantConfined
} from "@/src/entities/models/base";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { type SQL } from "drizzle-orm/sql";
import pg from "pg";
import { UnauthorizedError } from "@/src/entities/errors/auth";
import { uuid } from "@/src/entities/models/uuid";
import type { PgColumn, PgInsertValue, PgTable } from "drizzle-orm/pg-core";

const { Pool } = pg;

type Dependencies = {
  cxt: ApplicationContext;
};

export const createDbService = (deps: Dependencies): IDbService => {
  const { cxt } = deps;
  const DB_URL = process.env.DB_URL;
  if (!DB_URL) {
    throw new AppInitializationError("Missing DB_URL");
  }
  const pool = new Pool({
    connectionString: DB_URL
  });
  const db = drizzle(pool, { schema });

  function initMetadata<T>(insert: T): T & BaseResource {
    const baseResource = insert as Partial<BaseResource>;
    baseResource.id = uuid();
    baseResource.createdBy = cxt.getUser()?.id ?? "";
    baseResource.createdAt = new Date();
    const resourceWithMetadata = insert as T & BaseResource;
    updateMetadata(resourceWithMetadata);
    return resourceWithMetadata;
  }

  function initMetadataAndTenant<T>(
    insert: T
  ): T & BaseResource & TenantConfined {
    const resourceWithMetadata = initMetadata(insert as Partial<BaseResource>);
    (resourceWithMetadata as Partial<TenantConfined>).tenantId =
      cxt.getUser()?.tenantId;
    return resourceWithMetadata as T & BaseResource & TenantConfined;
  }

  function updateMetadata(resource: Partial<BaseResource>) {
    if (isTenantConfined(resource) && resource.tenantId !== cxt.getTenantId()) {
      throw new UnauthorizedError("Tenant mismatch");
    }
    resource.updatedAt = new Date();
    resource.updatedBy = cxt.getUser()?.id ?? "";
  }

  function getSiteFilter<T extends { tenantId: PgColumn }>(
    table: T
  ): SQL<unknown> | undefined {
    const tenantId = cxt.getTenantId();
    return tenantId ? eq(table.tenantId, tenantId) : undefined;
  }

  function withSiteFilter<T extends { tenantId: PgColumn }>(
    table: T,
    existingWhere?: SQL<unknown>
  ) {
    const siteFilter = getSiteFilter(table);
    if (!siteFilter) return existingWhere;
    return existingWhere ? and(siteFilter, existingWhere) : siteFilter;
  }

  // Enhanced methods with automatic site filtering
  async function findMany<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options: QueryOptions = {}
  ): Promise<Array<T["$inferSelect"]>> {
    const { where, orderBy, limit, offset } = options;
    const siteWhere = withSiteFilter(table, where);

    const query = db
      .select()
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .from(table as any)
      .where(siteWhere);

    if (orderBy) {
      query.orderBy(orderBy);
    }
    if (limit) {
      query.limit(limit);
    }
    if (offset) {
      query.offset(offset);
    }

    return (await query) as Array<T["$inferSelect"]>;
  }

  async function findFirst<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options: QueryOptions = {}
  ): Promise<T["$inferSelect"] | null> {
    const { where, orderBy } = options;
    const siteWhere = withSiteFilter(table, where);

    const query = db
      .select()
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .from(table as any)
      .where(siteWhere);

    if (orderBy) {
      query.orderBy(orderBy);
    }

    const results = await query.limit(1);
    return (results[0] as T["$inferSelect"]) || null;
  }

  async function update<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: Record<string, unknown>,
    where: SQL<unknown>
  ) {
    const siteWhere = withSiteFilter(table, where);
    if (!siteWhere) {
      throw new Error("Cannot update without site context");
    }

    await db
      .update(table)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .set(values as any)
      .where(siteWhere);
  }

  async function deleteRecord<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    where: SQL<unknown>
  ) {
    const siteWhere = withSiteFilter(table, where);
    if (!siteWhere) {
      throw new Error("Cannot delete without site context");
    }

    await db.delete(table).where(siteWhere);
  }

  async function insert<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: PgInsertValue<T>
  ) {
    await db.insert(table).values(values);
  }

  async function count<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options: { where?: SQL<unknown> } = {}
  ): Promise<number> {
    const { where } = options;
    const siteWhere = withSiteFilter(table, where);
    if (!siteWhere) {
      throw new Error("Cannot count without site context");
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .from(table as any)
      .where(siteWhere);

    return result[0]?.count ?? 0;
  }

  // Global methods without site filtering
  async function findManyGlobal<T extends PgTable>(
    table: T,
    options: QueryOptions = {}
  ): Promise<Array<T["$inferSelect"]>> {
    const { where, orderBy, limit, offset } = options;

    const query = db
      .select()
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .from(table as any);

    if (where) {
      query.where(where);
    }
    if (orderBy) {
      query.orderBy(orderBy);
    }
    if (limit) {
      query.limit(limit);
    }
    if (offset) {
      query.offset(offset);
    }

    return (await query) as Array<T["$inferSelect"]>;
  }

  async function findFirstGlobal<T extends PgTable>(
    table: T,
    options: QueryOptions = {}
  ): Promise<T["$inferSelect"] | null> {
    const { where, orderBy } = options;

    const query = db
      .select()
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .from(table as any);

    if (where) {
      query.where(where);
    }
    if (orderBy) {
      query.orderBy(orderBy);
    }

    const results = await query.limit(1);
    return (results[0] as T["$inferSelect"]) || null;
  }

  async function updateGlobal<T extends PgTable>(
    table: T,
    values: Record<string, unknown>,
    where: SQL<unknown>
  ) {
    await db
      .update(table)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .set(values as any)
      .where(where);
  }

  async function deleteGlobal<T extends PgTable>(
    table: T,
    where: SQL<unknown>
  ) {
    await db.delete(table).where(where);
  }

  async function insertGlobal<T extends PgTable>(
    table: T,
    values: PgInsertValue<T>
  ) {
    await db.insert(table).values(values);
  }

  async function insertGlobalReturning<T extends PgTable>(
    table: T,
    values: PgInsertValue<T>
  ): Promise<T["$inferSelect"]> {
    const result = await db.insert(table).values(values).returning();
    return result[0] as T["$inferSelect"];
  }

  async function insertGlobalReturningMany<T extends PgTable>(
    table: T,
    values: PgInsertValue<T>[]
  ): Promise<T["$inferSelect"][]> {
    if (values.length === 0) return [];
    const result = await db.insert(table).values(values).returning();
    return result as T["$inferSelect"][];
  }

  async function countGlobal<T extends PgTable>(
    table: T,
    where?: SQL<unknown>
  ): Promise<number> {
    const query = db
      .select({ count: sql<number>`count(*)` })
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type system complexity with generic tables
      .from(table as any);

    if (where) {
      query.where(where);
    }

    const result = await query;
    return result[0]?.count ?? 0;
  }

  return {
    initMetadata,
    initMetadataAndTenant,
    updateMetadata,
    getSiteFilter,
    withSiteFilter,
    findMany,
    findFirst,
    update,
    delete: deleteRecord,
    insert,
    count,
    findManyGlobal,
    findFirstGlobal,
    updateGlobal,
    deleteGlobal,
    insertGlobal,
    insertGlobalReturning,
    insertGlobalReturningMany,
    countGlobal
  };
};
