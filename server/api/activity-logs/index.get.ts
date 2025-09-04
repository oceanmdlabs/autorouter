import type { ActivityLogEntry } from "@/src/entities/models/activity-log-entry";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";

export default defineEventHandler(
  async (event): Promise<PaginatedResult<ActivityLogEntry>> => {
    const cxt = await toApplicationContext(event);
    const query = getQuery(event);

    return await cxt.getActivityLogEntriesRepository().getAllAtTenant({
      page: Number(query.page) || 1,
      pageSize: Number(query.pageSize) || 10,
      searchTerm: query.search as string,
    });
  }
);
