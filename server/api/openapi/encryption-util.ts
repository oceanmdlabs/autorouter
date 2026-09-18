import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { type EncryptedBlockDto } from "@/src/entities/models/ocean-patient";

const KEY_LEN_BYTES = 16;
const IV_LEN_BYTES = 16;

export interface PrivateKey {
  n: string;
  e: string;
  d: string;
  p: string;
  q: string;
  dmp1: string;
  dmq1: string;
  coeff: string;
}

export type Bytes = Buffer;
export type Key = Bytes;

export function generateKey(): Key {
  return randomBytes(KEY_LEN_BYTES);
}

export function toBase64(bytes: Bytes): string {
  return bytes.toString("base64");
}

export function decryptWithSharedEncryptionKey({
  encryptedData,
  sharedEncryptionKey,
}: {
  encryptedData: EncryptedBlockDto;
  sharedEncryptionKey: string;
}): Bytes {
  return decrypt({
    encryptedData,
    key: getSecretKeyBytes(sharedEncryptionKey),
  });
}

export function decryptWithBase64Key({
  encryptedData,
  key,
}: {
  encryptedData: EncryptedBlockDto;
  key: string;
}): Bytes {
  return decryptWithKey({
    encryptedData,
    key: Buffer.from(key, "base64"),
  });
}

export function decryptWithKey({
  encryptedData,
  key,
}: {
  encryptedData: EncryptedBlockDto;
  key: Bytes;
}): Bytes {
  return decrypt({ encryptedData, key });
}

export function decrypt({
  encryptedData,
  key,
}: {
  encryptedData: EncryptedBlockDto;
  key: Bytes;
}): Bytes {
  const algorithm = getAESAlgorithm(key);
  const decipher = createDecipheriv(
    algorithm,
    key,
    Buffer.from(encryptedData.iv, "base64"),
  );

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedData.data, "base64")),
    decipher.final(),
  ]);
}

export function toUtf8(bytes: Bytes): string {
  return bytes.toString("utf8");
}

function getSecretKeyBytes(secretKey: string): Bytes {
  return Buffer.from(secretKey.padEnd(KEY_LEN_BYTES, "0"), "utf8");
}

export function encryptObject(object: unknown, key: Key) {
  return encryptString(JSON.stringify(object), key);
}

export function encryptString(plaintext: string, key: Key) {
  return encryptBytes(Buffer.from(plaintext, "utf8"), key);
}

export function encryptBytes(bytes: Bytes, key: Key) {
  const iv = randomBytes(IV_LEN_BYTES);
  const usableKey = truncateToUsableAESKey(key);
  const cipher = createCipheriv(getAESAlgorithm(usableKey), usableKey, iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);

  return {
    data: encrypted.toString("base64"),
    iv: iv.toString("base64"),
  };
}

function truncateToUsableAESKey(key: Bytes): Bytes {
  if (key.length > 32) {
    return key.subarray(0, 32);
  }
  if (key.length > 24 && key.length < 32) {
    return key.subarray(0, 24);
  }
  if (key.length > 16 && key.length < 24) {
    return key.subarray(0, 16);
  }
  return key;
}

function getAESAlgorithm(
  key: Bytes,
): "aes-128-cbc" | "aes-192-cbc" | "aes-256-cbc" {
  switch (key.length) {
    case 16:
      return "aes-128-cbc";
    case 24:
      return "aes-192-cbc";
    case 32:
      return "aes-256-cbc";
    default:
      throw new Error("AES keys must be 16, 24, or 32 bytes");
  }
}
