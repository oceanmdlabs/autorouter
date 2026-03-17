import type { ActivityLogEntry } from "@/src/entities/models/activity-log-entry";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";

export default defineEventHandler(
  async (event): Promise<PaginatedResult<ActivityLogEntry>> => {
    const cxt = await toApplicationContext(event);
    const query = getQuery(event);
    const searchTerm = query.search as string;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    await logPrivacyAuditEvent(cxt, {
      eventType: searchTerm ? "activity_logs_filtered" : "activity_logs_viewed",
      subjectType: "activity_logs",
      summary: searchTerm
        ? "Viewed activity logs with filters."
        : "Viewed activity logs.",
      sensitiveData: searchTerm
        ? {
            search: searchTerm,
            page,
            pageSize,
          }
        : {
            page,
            pageSize,
          },
    });

    return await cxt.getActivityLogEntriesRepository().getAllAtTenant({
      page,
      pageSize,
      searchTerm,
    });
  }
);
