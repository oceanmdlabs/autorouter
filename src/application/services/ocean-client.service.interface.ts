import type { Bundle, FhirResource } from "fhir/r4";
import type { OceanServer } from "./ocean-server.utils";

export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export type OceanClientCredentials = {
  oceanServer: OceanServer;
  oceanClientId: string;
  oceanClientSecret: string;
};

export type SendOceanMessageParameters = {
  message: Bundle;
  credentials?: OceanClientCredentials;
  version?: "v11" | "v12";
};

export interface IOceanClientService {
  fetchOceanClientCredentials(): Promise<OceanClientCredentials>;
  testConnection(credentials: OceanClientCredentials): Promise<Response>;
  sendMessage({
    message,
    credentials,
    version,
  }: SendOceanMessageParameters): Promise<Response>;
  fetchLetterData({
    letterUrl,
    credentials,
  }: {
    letterUrl: string;
    credentials?: OceanClientCredentials;
  }): Promise<Buffer<ArrayBufferLike>>;
}
