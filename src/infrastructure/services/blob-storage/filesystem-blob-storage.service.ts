import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IBlobStorageService, PutBlobInput } from "@/src/application/services/blob-storage.service.interface";

function storageRoot() {
  return process.env.EREQUEST_FILESYSTEM_STORAGE_ROOT ?? ".data/erequest-blobs";
}

function resolvePath(key: string) {
  return path.join(storageRoot(), key);
}

export function createFilesystemBlobStorageService(): IBlobStorageService {
  async function putObject(input: PutBlobInput) {
    const filePath = resolvePath(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    return {
      storageKey: input.key,
      byteSize: input.body.byteLength,
      contentType: input.contentType,
      storageBucket: storageRoot(),
    };
  }

  async function getObjectStream(input: { key: string }) {
    const filePath = resolvePath(input.key);
    const fileStat = await stat(filePath);
    return {
      stream: createReadStream(filePath),
      byteSize: fileStat.size,
    };
  }

  async function headObject(input: { key: string }) {
    try {
      const fileStat = await stat(resolvePath(input.key));
      return { exists: true, byteSize: fileStat.size };
    } catch {
      return { exists: false };
    }
  }

  async function deleteObject(input: { key: string }) {
    await rm(resolvePath(input.key), { force: true });
  }

  function buildStorageKey(input: {
    tenantId: string;
    erequestId: string;
    filename: string;
    kind: string;
  }) {
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const hash = createHash("sha1").update(safeName).digest("hex").slice(0, 8);
    return path.join(input.tenantId, input.erequestId, input.kind, `${hash}-${safeName}`);
  }

  return {
    getProvider: () => "filesystem",
    putObject,
    getObjectStream,
    headObject,
    deleteObject,
    buildStorageKey,
  };
}
