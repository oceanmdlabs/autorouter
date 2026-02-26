import CryptoJS from "crypto-js";
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

export type Bytes = CryptoJS.lib.WordArray;
export type Key = Bytes;

export function generateKey(): Key {
  return CryptoJS.lib.WordArray.random(16);
}

export function toBase64(bytes: CryptoJS.lib.WordArray): string {
  return CryptoJS.enc.Base64.stringify(bytes);
}

export function decryptWithSharedEncryptionKey({
  encryptedData,
  sharedEncryptionKey,
}: {
  encryptedData: EncryptedBlockDto;
  sharedEncryptionKey: string;
}): Bytes {
  const sekAsBytes: Bytes = getSecretKeyBytes(sharedEncryptionKey);
  return decrypt({ encryptedData, key: sekAsBytes });
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
    key: CryptoJS.enc.Base64.parse(key),
  });
}

export function decryptWithKey({
  encryptedData,
  key,
}: {
  encryptedData: EncryptedBlockDto;
  key: Bytes;
}): Bytes {
  const ivAsBytes: Bytes = CryptoJS.enc.Base64.parse(encryptedData.iv);
  const decryptedBytes = CryptoJS.AES.decrypt(encryptedData.data, key, {
    iv: ivAsBytes,
  });
  return decryptedBytes;
}

export function decrypt({
  encryptedData,
  key,
}: {
  encryptedData: EncryptedBlockDto;
  key: Bytes;
}): Bytes {
  const ivAsBytes: Bytes = CryptoJS.enc.Base64.parse(encryptedData.iv);
  const decryptedBytes = CryptoJS.AES.decrypt(encryptedData.data, key, {
    iv: ivAsBytes,
  });
  return decryptedBytes;
}

export function toUtf8(bytes: Bytes): string {
  return CryptoJS.enc.Utf8.stringify(bytes);
}

function getSecretKeyBytes(secretKey: string): Bytes {
  // We need the bytes of our keys to use in decryption
  while (secretKey.length < 16) secretKey += "0"; //Zero pad the secretKey to 16 bytes
  return CryptoJS.enc.Utf8.parse(secretKey);
}

export function encryptObject(object: unknown, key: Key) {
  return encryptString(JSON.stringify(object), key);
}

export function encryptString(plaintext: string, key: Key) {
  return encryptBytes(CryptoJS.enc.Utf8.parse(plaintext), key);
}

export function encryptBytes(bytes: Bytes, key: Key) {
  const ivBytes: Bytes = CryptoJS.lib.WordArray.random(16);

  const encryptedCryptoJS = CryptoJS.AES.encrypt(
    bytes,
    truncateToUsableAESKey(key),
    { iv: ivBytes }
  );
  const encryptedBlockDto = {
    data: CryptoJS.enc.Base64.stringify(encryptedCryptoJS.ciphertext),
    iv: CryptoJS.enc.Base64.stringify(ivBytes),
  };
  return encryptedBlockDto;
}

function truncateToUsableAESKey(keyBytes: Bytes) {
  if (keyBytes.sigBytes > 32) {
    keyBytes.sigBytes = 32;
  } else if (keyBytes.sigBytes > 24 && keyBytes.sigBytes < 32) {
    keyBytes.sigBytes = 24;
  } else if (keyBytes.sigBytes > 16 && keyBytes.sigBytes < 24) {
    keyBytes.sigBytes = 16;
  }
  return keyBytes;
}
