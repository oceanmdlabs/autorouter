import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import type {
  Erequest,
  ErequestSearchOptions,
  NewErequest,
  UpdateErequest,
} from "@/src/entities/models/erequest";
import type { ErequestBlob, NewErequestBlob } from "@/src/entities/models/erequest-blob";

export interface IErequestsRepository {
  findByMessageChecksum(messageChecksum: string): Promise<Erequest | null>;
  /**
   * Returns archived inbound (`request_received`) eRequests for the current
   * tenant whose patient date of birth exactly matches `dob`, ordered by
   * `receivedAt` descending. Used by the intake-to-referral matcher; health
   * number and name normalization is performed in application code.
   */
  findInboundReceivedByDateOfBirth(dob: Date): Promise<Erequest[]>;
  create(record: NewErequest): Promise<Erequest>;
  update(record: UpdateErequest): Promise<Erequest>;
  createBlob(record: NewErequestBlob): Promise<ErequestBlob>;
  listBlobs(erequestId: string): Promise<ErequestBlob[]>;
  get(id: string): Promise<(Erequest & { blobs: ErequestBlob[] }) | null>;
  count(options?: Omit<ErequestSearchOptions, "page" | "pageSize">): Promise<number>;
  getBlob(
    erequestId: string,
    blobId: string
  ): Promise<ErequestBlob | null>;
  search(
    options?: ErequestSearchOptions
  ): Promise<PaginatedResult<Erequest>>;
}
