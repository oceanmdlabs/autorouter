import type {
  ActivityLogEntry,
  NewActivityLogEntry,
  UpdateActivityLogEntry,
} from "@/src/entities/models/activity-log-entry";
import type { PaginatedResult } from "../../entities/models/paginated-result";

export type SearchOptions = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
};

export interface IActivityLogEntriesRepository {
  getAllAtTenant(
    options?: SearchOptions
  ): Promise<PaginatedResult<ActivityLogEntry>>;
  get(id: string): Promise<ActivityLogEntry | null>;
  create(record: NewActivityLogEntry): Promise<void>;
  update(record: UpdateActivityLogEntry): Promise<void>;
  remove(id: string): Promise<void>;
  removeAll(): Promise<void>;
}
