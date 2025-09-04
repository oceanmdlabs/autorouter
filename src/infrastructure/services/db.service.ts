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
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm/sql";
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
  let db: NodePgDatabase<typeof schema> | null = null;

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

  return {
    getDb() {
      if (!db) {
        const DB_URL = process.env.DB_URL;
        if (!DB_URL) {
          throw new AppInitializationError("Missing DB_URL");
        }
        const pool = new Pool({
          connectionString: DB_URL,
        });
        db = drizzle(pool, { schema });
      }
      return db;
    },
    initMetadata,
    initMetadataAndTenant,
    updateMetadata,
    findExistingResourceBasedOnIdOrIdentifier,
  };
};
