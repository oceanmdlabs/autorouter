import type { IOceanClientService, OceanClientCredentials } from "@/src/application/services/ocean-client.service.interface";

/**
 * Request-scoped cache that fetches Ocean client credentials once and
 * deduplicates document downloads within a single inbound request.
 * Storing promises (not resolved values) means concurrent calls to the
 * same URL share one in-flight request rather than racing.
 */
export class DocumentDownloadCache {
  private credentialsPromise: Promise<OceanClientCredentials> | null = null;
  private readonly downloads = new Map<string, Promise<Buffer>>();

  constructor(private readonly oceanClient: IOceanClientService) {}

  fetchCredentials(): Promise<OceanClientCredentials> {
    if (!this.credentialsPromise) {
      this.credentialsPromise = this.oceanClient.fetchOceanClientCredentials();
    }
    return this.credentialsPromise;
  }

  fetchLetterData(letterUrl: string): Promise<Buffer> {
    const cached = this.downloads.get(letterUrl);
    if (cached) {
      console.log(`[DocumentDownloadCache] cache HIT: ${letterUrl}`);
      return cached;
    }

    console.log(`[DocumentDownloadCache] cache MISS — fetching: ${letterUrl}`);
    const promise = this.fetchCredentials().then((credentials) =>
      this.oceanClient.fetchLetterData({ letterUrl, credentials })
    ) as Promise<Buffer>;

    this.downloads.set(letterUrl, promise);
    return promise;
  }
}
