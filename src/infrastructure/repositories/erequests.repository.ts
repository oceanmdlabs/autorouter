import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import type { IErequestsRepository } from "@/src/application/repositories/erequests.repository.interface";
import {
  erequestBlobs,
  erequests,
} from "@/drizzle/schema";
import type { ErequestSearchOptions, NewErequest, UpdateErequest } from "@/src/entities/models/erequest";
import type { NewErequestBlob } from "@/src/entities/models/erequest-blob";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";

type Dependencies = { cxt: ApplicationContext };

export function createErequestsRepository({
  cxt,
}: Dependencies): IErequestsRepository {
  const db = createDbClient();
  const dbService = cxt.getDbService();

  function mapStorageStatus(value: string) {
    return sql`${value}::erequest_storage_status`;
  }

  function mapProvider(value: string) {
    return sql`${value}::erequest_storage_provider`;
  }

  function mapBlobKind(value: string) {
    return sql`${value}::erequest_blob_kind`;
  }

  function mapDownloadStatus(value: string) {
    return sql`${value}::erequest_blob_download_status`;
  }

  function buildWhere(options?: ErequestSearchOptions) {
    const tenantId = cxt.getNonEmptyTenantId();
    const clauses = [eq(erequests.tenantId, tenantId)];

    if (options?.search) {
      clauses.push(
        sql`to_tsvector(
          'english',
          concat_ws(
            ' ',
            coalesce(${erequests.patientName}, ''),
            coalesce(${erequests.patientHealthNumber}, ''),
            coalesce(${erequests.patientMedicalRecordNumber}, ''),
            coalesce(${erequests.referringProvider}, ''),
            coalesce(${erequests.receivingProvider}, ''),
            coalesce(${erequests.referralRef}, ''),
            coalesce(${erequests.requestedListingTitle}, ''),
            coalesce(${erequests.requestedServiceDescription}, '')
          )
        ) @@ plainto_tsquery('english', ${options.search})`
      );
    }

    if (options?.healthNumber) {
      clauses.push(ilike(erequests.patientHealthNumber, `%${options.healthNumber}%`));
    }
    if (options?.medicalRecordNumber) {
      clauses.push(
        ilike(erequests.patientMedicalRecordNumber, `%${options.medicalRecordNumber}%`)
      );
    }
    if (options?.patientName) {
      clauses.push(ilike(erequests.patientName, `%${options.patientName}%`));
    }
    if (options?.referringProvider) {
      clauses.push(ilike(erequests.referringProvider, `%${options.referringProvider}%`));
    }
    if (options?.receivingProvider) {
      clauses.push(ilike(erequests.receivingProvider, `%${options.receivingProvider}%`));
    }
    if (options?.referralRef) {
      clauses.push(ilike(erequests.referralRef, `%${options.referralRef}%`));
    }
    if (options?.requestedListing) {
      clauses.push(
        or(
          ilike(erequests.requestedListingTitle, `%${options.requestedListing}%`),
          ilike(erequests.requestedListingRef, `%${options.requestedListing}%`)
        )!
      );
    }
    if (options?.healthServiceType) {
      clauses.push(sql`${options.healthServiceType} = ANY(${erequests.healthServiceTypes})`);
    }
    if (options?.receivedFrom) {
      clauses.push(gte(erequests.receivedAt, options.receivedFrom));
    }
    if (options?.receivedTo) {
      clauses.push(lte(erequests.receivedAt, options.receivedTo));
    }

    return and(...clauses);
  }

  return {
    async findByMessageChecksum(messageChecksum) {
      const record = await dbService.findFirst(erequests, {
        where: eq(erequests.messageChecksum, messageChecksum),
      });
      return record;
    },

    async create(record: NewErequest) {
      const insertRecord = {
        ...dbService.initMetadataAndTenant(record),
        storageStatus: mapStorageStatus(record.storageStatus),
      };
      await db
        .insert(erequests)
        .values(insertRecord as unknown as typeof erequests.$inferInsert);
      const created = await dbService.findFirst(erequests, {
        where: eq(erequests.id, insertRecord.id),
      });
      return created!;
    },

    async update(record: UpdateErequest) {
      const updateRecord: Record<string, unknown> = { ...record };
      if (record.storageStatus) {
        updateRecord.storageStatus = mapStorageStatus(record.storageStatus);
      }
      dbService.updateMetadata(updateRecord);
      await db.update(erequests).set(updateRecord).where(
        and(
          eq(erequests.id, record.id),
          eq(erequests.tenantId, cxt.getNonEmptyTenantId())
        )
      );
      const updated = await dbService.findFirst(erequests, {
        where: eq(erequests.id, record.id),
      });
      return updated!;
    },

    async createBlob(record: NewErequestBlob) {
      const insertRecord = {
        ...dbService.initMetadataAndTenant(record),
        kind: mapBlobKind(record.kind),
        storageProvider: mapProvider(record.storageProvider),
        downloadStatus: mapDownloadStatus(record.downloadStatus),
      };
      await db
        .insert(erequestBlobs)
        .values(insertRecord as unknown as typeof erequestBlobs.$inferInsert);
      const created = await dbService.findFirst(erequestBlobs, {
        where: eq(erequestBlobs.id, insertRecord.id),
      });
      return created!;
    },

    async listBlobs(erequestId) {
      return await dbService.findMany(erequestBlobs, {
        where: eq(erequestBlobs.erequestId, erequestId),
        orderBy: desc(erequestBlobs.createdAt),
      });
    },

    async get(id) {
      const erequest = await dbService.findFirst(erequests, {
        where: eq(erequests.id, id),
      });
      if (!erequest) {
        return null;
      }
      const blobs = await this.listBlobs(id);
      return { ...erequest, blobs };
    },

    async getBlob(erequestId, blobId) {
      return await dbService.findFirst(erequestBlobs, {
        where: and(
          eq(erequestBlobs.id, blobId),
          eq(erequestBlobs.erequestId, erequestId)
        ),
      });
    },

    async count(options) {
      const where = buildWhere(options);
      const total = await db
        .select({ count: sql<number>`count(*)` })
        .from(erequests)
        .where(where);

      return total[0]?.count ?? 0;
    },

    async search(options) {
      const page = options?.page ?? 1;
      const pageSize = options?.pageSize ?? 20;
      const where = buildWhere(options);

      const [items, total] = await Promise.all([
        db
          .select()
          .from(erequests)
          .where(where)
          .orderBy(desc(erequests.receivedAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)` })
          .from(erequests)
          .where(where),
      ]);

      return {
        items,
        total: total[0]?.count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((total[0]?.count ?? 0) / pageSize),
      };
    },
  };
}
