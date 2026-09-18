import { describe, expect, it } from "vitest";
import {
  decryptWithBase64Key,
  decryptWithKey,
  decryptWithSharedEncryptionKey,
  encryptObject,
  encryptString,
  generateKey,
  toBase64,
  toUtf8,
} from "./encryption-util";

describe("Ocean OpenAPI encryption", () => {
  it("decrypts the CryptoJS one-time-key and payload chain used by Ocean", () => {
    // Synthetic fixture generated with the algorithm in Ocean's official API sample:
    // CryptoJS AES-CBC with PKCS#7 padding and a 16-character SEK.
    const iv = "Dw4NDAsKCQgHBgUEAwIBAA==";
    const oneTimeKey = decryptWithSharedEncryptionKey({
      encryptedData: {
        data: "ZCg4D4k1F2dDSlkkfIoLKQfq/pa/qUOJHKtd8M/rp+I=",
        iv,
      },
      sharedEncryptionKey: "TestKey1!2345678",
    });

    expect(toBase64(oneTimeKey)).toBe("ABEiM0RVZneImaq7zN3u/w==");

    const payload = decryptWithKey({
      encryptedData: {
        data: "mQDoH29JfgfJ2sog9MRa9B3Mfm+P2TsIcXq86M8XbwE7bkKKV+Ff7P/ns/xcHgSy",
        iv,
      },
      key: oneTimeKey,
    });

    expect(JSON.parse(toUtf8(payload))).toEqual({
      ref: "synthetic-ref",
      status: "test",
    });
  });

  it("round trips strings with generated keys", () => {
    const key = generateKey();
    const encrypted = encryptString("Ocean Autorouter", key);

    expect(
      toUtf8(
        decryptWithBase64Key({
          encryptedData: encrypted,
          key: toBase64(key),
        }),
      ),
    ).toBe("Ocean Autorouter");
  });

  it("round trips JSON objects", () => {
    const key = generateKey();
    const encrypted = encryptObject({ status: "ready" }, key);
    const decrypted = decryptWithBase64Key({
      encryptedData: encrypted,
      key: toBase64(key),
    });

    expect(JSON.parse(toUtf8(decrypted))).toEqual({ status: "ready" });
  });
});
