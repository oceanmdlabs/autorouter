import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import type {
  PrivacyAuditEventType,
  PrivacyAuditLog,
} from "@/src/entities/models/privacy-audit-log";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import {
  assertPrivacyAuditAccess,
  logPrivacyAuditEvent,
} from "@/server/utils/privacy-audit";

export default defineEventHandler(
  async (event): Promise<PaginatedResult<PrivacyAuditLog>> => {
    const cxt = await toApplicationContext(event);
    await assertPrivacyAuditAccess(cxt);

    const query = getQuery(event);
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 25;
    const eventType =
      typeof query.eventType === "string"
        ? (query.eventType as PrivacyAuditEventType)
        : undefined;

    await logPrivacyAuditEvent(cxt, {
      eventType: eventType
        ? "privacy_audit_logs_filtered"
        : "privacy_audit_logs_viewed",
      subjectType: "privacy_audit_logs",
      summary: eventType
        ? "Viewed privacy audit log with event-type filter."
        : "Viewed privacy audit log.",
      sensitiveData: {
        eventType: eventType ?? null,
        page,
        pageSize,
      },
    });

    return await cxt.getPrivacyAuditLogsRepository().listAtTenant({
      page,
      pageSize,
      eventType,
    });
  }
);
