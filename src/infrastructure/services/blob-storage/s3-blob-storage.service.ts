import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { IBlobStorageService, PutBlobInput } from "@/src/application/services/blob-storage.service.interface";

type Dependencies = {
  bucket: string;
  region?: string;
  prefix?: string;
};

export function createS3BlobStorageService(
  deps: Dependencies
): IBlobStorageService {
  const client = new S3Client({
    region: deps.region || process.env.AWS_REGION || "us-east-1",
  });

  const withPrefix = (key: string) =>
    deps.prefix ? `${deps.prefix.replace(/\/+$/, "")}/${key}` : key;

  async function putObject(input: PutBlobInput) {
    const key = withPrefix(input.key);
    await client.send(
      new PutObjectCommand({
        Bucket: deps.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      })
    );
    return {
      storageKey: input.key,
      byteSize: input.body.byteLength,
      contentType: input.contentType,
      storageBucket: deps.bucket,
    };
  }

  async function getObjectStream(input: { key: string }) {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: deps.bucket,
        Key: withPrefix(input.key),
      })
    );
    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
      byteSize: response.ContentLength,
    };
  }

  async function headObject(input: { key: string }) {
    try {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: deps.bucket,
          Key: withPrefix(input.key),
        })
      );
      return {
        exists: true,
        byteSize: response.ContentLength,
        contentType: response.ContentType,
      };
    } catch {
      return { exists: false };
    }
  }

  async function deleteObject(input: { key: string }) {
    await client.send(
      new DeleteObjectCommand({
        Bucket: deps.bucket,
        Key: withPrefix(input.key),
      })
    );
  }

  function buildStorageKey(input: {
    tenantId: string;
    erequestId: string;
    filename: string;
    kind: string;
  }) {
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${input.tenantId}/${input.erequestId}/${input.kind}/${safeName}`;
  }

  return {
    getProvider: () => "s3",
    putObject,
    getObjectStream,
    headObject,
    deleteObject,
    buildStorageKey,
  };
}
