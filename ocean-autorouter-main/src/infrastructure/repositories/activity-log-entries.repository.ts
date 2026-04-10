import type { ApplicationContext } from "@/src/entities/models/application-context";
import { eq, desc, sql } from "drizzle-orm";
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
  const dbService = cxt.getDbService();
  return {
    async getAllAtTenant(options?: SearchOptions) {
      const page = options?.page ?? 1;
      const pageSize = options?.pageSize ?? 10;
      const searchTerm = options?.searchTerm?.toLowerCase();

      const whereClause = searchTerm
        ? sql`to_tsvector('english', ${table.searchText}) @@ plainto_tsquery('english', ${searchTerm})`
        : undefined;

      const [logs, total] = await Promise.all([
        dbService.findMany(table, {
          where: whereClause,
          orderBy: desc(table.createdAt),
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        dbService.count(table, { where: whereClause }),
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
      return await dbService.findFirst(table, {
        where: eq(table.id, id),
      });
    },

    async create(record: NewActivityLogEntry) {
      const searchText = buildSearchText(record);

      await dbService.insert(table, {
        ...dbService.initMetadataAndTenant(record),
        searchText,
      });
    },

    async update(record) {
      const searchText = buildSearchText(record);

      dbService.updateMetadata(record);
      await dbService.update(
        table,
        { ...record, searchText },
        eq(table.id, record.id)
      );
    },

    async remove(id) {
      cxt.logger.info("Removing activity log entry", { id });
      await dbService.delete(table, eq(table.id, id));
    },

    async removeAll() {
      cxt.logger.info("Removing all activity log entries");
      await dbService.delete(table, sql`TRUE`);
    },
  };
};
