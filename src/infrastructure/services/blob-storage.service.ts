import type { IBlobStorageService } from "@/src/application/services/blob-storage.service.interface";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { createFilesystemBlobStorageService } from "./blob-storage/filesystem-blob-storage.service";
import { createS3BlobStorageService } from "./blob-storage/s3-blob-storage.service";

type Dependencies = {
  cxt: ApplicationContext;
};

export function createBlobStorageService({
  cxt,
}: Dependencies): IBlobStorageService {
  const siteConfig = cxt.getSiteConfigurationRepository();

  let cached: IBlobStorageService | null = null;

  const getService = async () => {
    if (cached) {
      return cached;
    }

    const config = await siteConfig.getForTenant();
    const provider = config?.erequestStorageProvider ?? "filesystem";
    if (provider === "s3") {
      const bucket =
        config?.erequestStorageBucket ?? process.env.EREQUEST_S3_BUCKET;
      if (!bucket) {
        throw new Error("Erequest archival is configured for S3 but no bucket is set.");
      }
      cached = createS3BlobStorageService({
        bucket,
        region:
          config?.erequestStorageRegion ?? process.env.EREQUEST_S3_REGION,
        prefix:
          config?.erequestStoragePrefix ?? process.env.EREQUEST_S3_PREFIX,
      });
      return cached;
    }

    cached = createFilesystemBlobStorageService();
    return cached;
  };

  return {
    getProvider() {
      return cached?.getProvider() ?? "filesystem";
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
      const provider = cached ?? createFilesystemBlobStorageService();
      return provider.buildStorageKey(input);
    },
  };
}
