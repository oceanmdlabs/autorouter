import { ApplicationContext } from "@/src/entities/models/application-context";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import { activityLogEntry as table } from "@/drizzle/schema";
import type { NewActivityLogEntry } from "@/src/entities/models/activity-log-entry";

type Dependencies = {
  cxt: ApplicationContext;
};

type SearchOptions = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
};

const buildSearchText = (record: NewActivityLogEntry): string => {
  return [
    record.requestingProvider,
    record.requestedListingTitle,
    record.requestedServiceDescription,
    record.details,
  ]
    .filter(Boolean)
    .join(" ");
};

export const createActivityLogEntriesRepository = ({
  cxt,
}: Dependencies): IActivityLogEntriesRepository => {
  const db = cxt.getDbService().getDb();
  return {
    async getAllAtTenant(options?: SearchOptions) {
      const page = options?.page ?? 1;
      const pageSize = options?.pageSize ?? 10;
      const searchTerm = options?.searchTerm?.toLowerCase();

      const whereClause = searchTerm
        ? and(
            eq(table.tenantId, cxt.getNonEmptyTenantId()),
            sql`to_tsvector('english', ${table.searchText}) @@ plainto_tsquery('english', ${searchTerm})`
          )
        : eq(table.tenantId, cxt.getNonEmptyTenantId());

      const [logs, total] = await Promise.all([
        db.query.activityLogEntry.findMany({
          where: whereClause,
          orderBy: [desc(table.createdAt)],
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        db
          .select({ count: sql<number>`count(*)` })
          .from(table)
          .where(whereClause)
          .then((result) => result[0]?.count ?? 0),
      ]);

      return {
        items: logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    async get(id: string) {
      return (
        (await db.query.activityLogEntry.findFirst({
          where: eq(table.id, id),
        })) ?? null
      );
    },

    async create(record: NewActivityLogEntry) {
      const searchText = buildSearchText(record);

      await db.insert(table).values({
        ...cxt.getDbService().initMetadataAndTenant(record),
        searchText,
      });
    },

    async update(record) {
      const searchText = buildSearchText(record);

      cxt.getDbService().updateMetadata(record);
      await db
        .update(table)
        .set({ ...record, searchText })
        .where(eq(table.id, record.id));
    },

    async remove(id) {
      cxt.logger.info("Removing activity log entry", { id });
      await db.delete(table).where(eq(table.id, id));
    },

    async removeAll() {
      cxt.logger.info("Removing all activity log entries");
      await db
        .delete(table)
        .where(eq(table.tenantId, cxt.getNonEmptyTenantId()));
    },
  };
};
