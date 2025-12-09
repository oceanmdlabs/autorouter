import * as schema from "@/drizzle/schema";
import type { IDbService } from "@/src/application/services/db.service.interface";
import { AppInitializationError } from "@/src/entities/errors/common";
import { ApplicationContext } from "@/src/entities/models/application-context";
import {
  isTenantConfined,
  type BaseResource,
  type NewBaseResource,
  type TenantConfined,
} from "@/src/entities/models/base";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq, and, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import pg from "pg";
import type { FhirData } from "@/src/entities/models/resource";
import { UnauthorizedError } from "@/src/entities/errors/auth";
import { uuid } from "@/src/entities/models/uuid";

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
    connectionString: DB_URL,
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

  async function findExistingResourceBasedOnIdOrIdentifier<
    T extends NewBaseResource & { content: FhirData }
  >(
    resource: T,
    table: { findFirst: (criteria: { with?: any; where?: any }) => any }
  ): Promise<T | null> {
    const fhir = resource.content as FhirData;
    if (resource.id) {
      const result = await table.findFirst({
        with: {
          id: resource.id,
        } as any,
      });
      if (result) {
        return result as T;
      }
    } else if (fhir.identifier?.length) {
      for (const identifier of fhir.identifier) {
        const identifierCriteria = JSON.stringify([
          { value: identifier.value },
        ]);
        const criteria = {
          where: sql`content -> 'identifier' @> ${identifierCriteria}::jsonb`,
        };
        const result = await table.findFirst(criteria);
        if (result) {
          return result as T;
        }
      }
    }
    return null;
  }

  function withSiteFilter<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    where?: SQL<unknown>
  ): SQL<unknown> | undefined {
    const tenantId = cxt.getTenantId();
    if (!tenantId) {
      return undefined;
    }
    const tenantFilter = eq(table.tenantId, tenantId);
    return where ? and(tenantFilter, where) : tenantFilter;
  }

  async function findMany<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options: {
      where?: SQL<unknown>;
      orderBy?: any;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    const { where, orderBy, limit, offset } = options;
    const siteWhere = withSiteFilter(table, where);
    if (!siteWhere) {
      throw new Error("Cannot query without site context");
    }

    let query: any = db
      .select()
      .from(table as any)
      .where(siteWhere);

    if (orderBy) {
      // Handle both single value and array for orderBy
      if (Array.isArray(orderBy)) {
        query = query.orderBy(...orderBy);
      } else {
        query = query.orderBy(orderBy);
      }
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    if (offset !== undefined) {
      query = query.offset(offset);
    }

    return await query;
  }

  async function findFirst<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    options: { where?: SQL<unknown> } = {}
  ): Promise<any | null> {
    const { where } = options;
    const siteWhere = withSiteFilter(table, where);
    if (!siteWhere) {
      throw new Error("Cannot query without site context");
    }

    const result = await db
      .select()
      .from(table as any)
      .where(siteWhere)
      .limit(1);

    return result[0] ?? null;
  }

  async function insert<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: any
  ): Promise<void> {
    await db.insert(table as any).values(values);
  }

  async function update<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    values: any,
    where: SQL<unknown>
  ): Promise<void> {
    const siteWhere = withSiteFilter(table, where);
    if (!siteWhere) {
      throw new Error("Cannot update without site context");
    }

    await db
      .update(table as any)
      .set(values)
      .where(siteWhere);
  }

  async function deleteRecord<T extends PgTable & { tenantId: PgColumn }>(
    table: T,
    where: SQL<unknown>
  ): Promise<void> {
    const siteWhere = withSiteFilter(table, where);
    if (!siteWhere) {
      throw new Error("Cannot delete without site context");
    }

    await db.delete(table as any).where(siteWhere);
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
      .from(table as any)
      .where(siteWhere);

    return result[0]?.count ?? 0;
  }

  return {
    initMetadata,
    initMetadataAndTenant,
    updateMetadata,
    findExistingResourceBasedOnIdOrIdentifier,
    findMany,
    findFirst,
    insert,
    update,
    delete: deleteRecord,
    count,
  };
};
