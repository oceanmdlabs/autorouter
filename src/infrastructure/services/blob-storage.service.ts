import type { IBlobStorageService } from "@/src/application/services/blob-storage.service.interface";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { createFilesystemBlobStorageService } from "./blob-storage/filesystem-blob-storage.service";
import { createS3BlobStorageService } from "./blob-storage/s3-blob-storage.service";

type Dependencies = {
  cxt: ApplicationContext;
};

const DEFAULT_EREQUEST_S3_BUCKET = "ocean-autorouter-erequests";
const DEFAULT_EREQUEST_S3_PREFIX = "erequests";

function resolveBlobStorageProvider(): "filesystem" | "s3" {
  const configured = process.env.EREQUEST_BLOB_STORAGE_PROVIDER;
  if (configured === "filesystem" || configured === "s3") {
    return configured;
  }

  // Default to filesystem locally when no S3 config is present.
  if (!process.env.AWS_REGION && !process.env.AWS_ACCESS_KEY_ID) {
    return "filesystem";
  }

  return "s3";
}

export function createBlobStorageService({
  cxt,
}: Dependencies): IBlobStorageService {
  let cached: IBlobStorageService | null = null;

  const getService = async () => {
    if (cached) {
      return cached;
    }

    cached =
      resolveBlobStorageProvider() === "filesystem"
        ? createFilesystemBlobStorageService()
        : createS3BlobStorageService({
            bucket: process.env.EREQUEST_S3_BUCKET ?? DEFAULT_EREQUEST_S3_BUCKET,
            region: process.env.AWS_REGION,
            prefix: process.env.EREQUEST_S3_PREFIX ?? DEFAULT_EREQUEST_S3_PREFIX,
          });
    return cached;
  };

  return {
    getProvider() {
      return cached?.getProvider() ?? "s3";
    },
    async putObject(input) {
      return (await getService()).putObject(input);
    },
    async getObjectStream(input) {
      return (await getService()).getObjectStream(input);
    },
    async headObject(input) {
      return (await getService()).headObject(input);
    },
    async deleteObject(input) {
      return (await getService()).deleteObject(input);
    },
    buildStorageKey(input) {
      const provider =
        cached ??
        (resolveBlobStorageProvider() === "filesystem"
          ? createFilesystemBlobStorageService()
          : createS3BlobStorageService({
              bucket: "__placeholder__",
              region: process.env.AWS_REGION,
              prefix: process.env.EREQUEST_S3_PREFIX ?? DEFAULT_EREQUEST_S3_PREFIX,
            }));
      return provider.buildStorageKey(input);
    },
  };
}
