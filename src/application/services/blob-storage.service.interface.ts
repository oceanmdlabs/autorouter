import type { Readable } from "node:stream";
import type { ErequestStorageProvider } from "@/src/entities/models/site-configuration";

export type PutBlobInput = {
  key: string;
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};

export type BlobHeadResult = {
  exists: boolean;
  byteSize?: number;
  contentType?: string;
};

export interface IBlobStorageService {
  getProvider(): ErequestStorageProvider;
  putObject(input: PutBlobInput): Promise<{
    storageKey: string;
    byteSize: number;
    contentType?: string;
    storageBucket?: string;
  }>;
  getObjectStream(input: {
    key: string;
  }): Promise<{
    stream: Readable;
    contentType?: string;
    byteSize?: number;
  }>;
  headObject(input: { key: string }): Promise<BlobHeadResult>;
  deleteObject(input: { key: string }): Promise<void>;
  buildStorageKey(input: {
    tenantId: string;
    erequestId: string;
    filename: string;
    kind: string;
  }): string;
}
