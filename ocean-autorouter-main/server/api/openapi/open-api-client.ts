import fetch, { Response } from "node-fetch";
import {
  type EncryptedBlockDto,
  type OceanPatient,
  type PatientNote,
  type PtUpdate,
} from "@/src/entities/models/ocean-patient";
import { IOError } from "@/src/entities/errors/common";
import {
  decryptWithKey,
  decryptWithSharedEncryptionKey,
  toUtf8,
} from "./encryption-util";
import {
  getOceanServerUrl,
  type OceanServer,
} from "@/src/application/services/ocean-server.utils";

export interface OceanAPISiteCreds {
  oceanHost: OceanServer;
  siteNum: string;
  siteKey: string;
  siteCredential: string;
  sharedEncryptionKey: string;
}

export function authPost({
  creds,
  path,
  body,
  headers,
}: {
  creds: OceanAPISiteCreds;
  path: string;
  body: string;
  headers?: { [key: string]: string };
}): Promise<Response> {
  return fetch(creds.oceanHost + path, {
    method: "POST",
    body,
    headers: headers ?? authHeaders(creds),
  });
}

export function authGet({
  creds,
  path,
  headers,
}: {
  creds: OceanAPISiteCreds;
  path: string;
  headers?: { [key: string]: string };
}): Promise<Response> {
  const url = getOceanServerUrl(creds.oceanHost) + path;
  return fetch(url, {
    method: "GET",
    headers: headers ?? authHeaders(creds),
  });
}

export function authHeaders(creds: OceanAPISiteCreds): {
  [key: string]: string;
} {
  return {
    siteNum: creds.siteNum,
    siteKey: creds.siteKey,
    siteCredential: creds.siteCredential,
    "Content-Type": "application/json",
  };
}

export function isError(result: any): result is Error {
  return result.message !== undefined && result.name !== undefined;
}

export async function getPatient({
  creds,
  ptRef,
}: {
  creds: OceanAPISiteCreds;
  ptRef: string;
}): Promise<OceanPatient | Error> {
  const result = await authGet({
    creds,
    path: `/svc/v1/patients/${ptRef}`,
  });
  if (result.ok) {
    const encryptedOtkData: string = result.headers.get("oneTimeKey") ?? "";
    const iv: string = result.headers.get("iv") ?? "";
    const externalPtRef: string = result.headers.get("extPatientRef") ?? "";
    const decryptedOtk = decryptWithSharedEncryptionKey({
      encryptedData: {
        data: encryptedOtkData,
        iv,
      },
      sharedEncryptionKey: creds.sharedEncryptionKey,
    });
    const data = readAndParseOceanData(await result.json());
    const encryptedData: EncryptedBlockDto = {
      data,
      iv,
    };
    const decryptedPatientData = decryptWithKey({
      encryptedData,
      key: decryptedOtk,
    });
    const decryptedPatientJson = toUtf8(decryptedPatientData);
    if (!decryptedPatientJson) {
      return new IOError("Failed to decrypt patient data");
    }
    const oceanPatient = JSON.parse(decryptedPatientJson) as OceanPatient;
    oceanPatient.externalPatientRef = externalPtRef;
    return oceanPatient;
  }
  return new IOError(result.status?.toString());
}

export async function getPatientNote({
  creds,
  ptRef,
  oceanSessionId,
}: {
  creds: OceanAPISiteCreds;
  ptRef: string;
  oceanSessionId?: string;
}): Promise<PatientNote | Error> {
  const result = await authGet({
    creds,
    path: `/svc/v1/patients/${ptRef}/notes?${
      oceanSessionId ? `oceanSessionId=${oceanSessionId}` : ""
    }`,
  });
  if (result.ok) {
    const noteId: string = result.headers.get("noteId") ?? "";
    const encryptedOtk: string = result.headers.get("oneTimeKey") ?? "";
    const oneTimeKeyIv: string = result.headers.get("oneTimeKeyIv") ?? "";
    const noteIv: string = result.headers.get("iv") ?? "";
    const externalPtRef: string = result.headers.get("externalPtRef") ?? "";
    // const payloadVersion: string = result.headers.get("payloadVersion") ?? "";
    const data = readAndParseOceanData(await result.json());
    const encryptedData: EncryptedBlockDto = {
      data,
      iv: noteIv,
    };
    const decryptedOtk = decryptWithSharedEncryptionKey({
      encryptedData: {
        data: encryptedOtk,
        iv: oneTimeKeyIv,
      },
      sharedEncryptionKey: creds.sharedEncryptionKey,
    });
    const decryptedJson = toUtf8(
      decryptWithKey({
        encryptedData,
        key: decryptedOtk,
      })
    );
    const ptUpdate = JSON.parse(decryptedJson) as PtUpdate;
    return {
      noteId,
      emrPtId: externalPtRef,
      ptUpdate,
    };
  } else {
    return new IOError(result.statusText);
  }
}
function readAndParseOceanData(arrayOrBase64: any): string {
  if (Array.isArray(arrayOrBase64)) return base64Array(arrayOrBase64);
  return arrayOrBase64 as string;
  // From public Ocean sample.html code;
  // for some historical reason, the calls return a JSON array of the crypto bytes instead of a base64 string

  function base64Array(array: number[]) {
    let arrayBuffer = new Int8Array(array.length);
    arrayBuffer.set(array);

    let base64 = "";
    const encodings =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    const bytes = new Uint8Array(arrayBuffer);
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;

    let a, b, c, d;
    let chunk;

    // Main loop deals with bytes in chunks of 3
    for (let i = 0; i < mainLength; i = i + 3) {
      // Combine the three bytes into a single integer
      chunk =
        ((bytes[i] ?? 0) << 16) |
        ((bytes[i + 1] ?? 0) << 8) |
        (bytes[i + 2] ?? 0);

      // Use bitmasks to extract 6-bit segments from the triplet
      a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
      b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
      c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
      d = chunk & 63; // 63       = 2^6 - 1

      // Convert the raw binary segments to the appropriate ASCII encoding
      base64 +=
        (encodings[a!] ?? "") +
        (encodings[b!] ?? "") +
        (encodings[c!] ?? "") +
        (encodings[d!] ?? "");
    }

    // Deal with the remaining bytes and padding
    if (byteRemainder == 1) {
      chunk = bytes[mainLength] ?? 0;

      a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

      // Set the 4 least significant bits to zero
      b = (chunk & 3) << 4; // 3   = 2^2 - 1

      base64 += (encodings[a!] ?? "") + (encodings[b!] ?? "") + "==";
    } else if (byteRemainder == 2) {
      chunk = ((bytes[mainLength] ?? 0) << 8) | (bytes[mainLength + 1] ?? 0);

      a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
      b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

      // Set the 2 least significant bits to zero
      c = (chunk & 15) << 2; // 15    = 2^4 - 1

      base64 +=
        (encodings[a!] ?? "") +
        (encodings[b!] ?? "") +
        (encodings[c!] ?? "") +
        "=";
    }

    return base64;
  }
}
