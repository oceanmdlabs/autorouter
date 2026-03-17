import type {
  NewPrivacyAuditLog,
  PrivacyAuditEventType,
  PrivacyAuditLog,
} from "@/src/entities/models/privacy-audit-log";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";

export type PrivacyAuditLogSearchOptions = {
  page?: number;
  pageSize?: number;
  eventType?: PrivacyAuditEventType;
};

export interface IPrivacyAuditLogsRepository {
  listAtTenant(
    options?: PrivacyAuditLogSearchOptions
  ): Promise<PaginatedResult<PrivacyAuditLog>>;
  create(record: NewPrivacyAuditLog): Promise<void>;
}
