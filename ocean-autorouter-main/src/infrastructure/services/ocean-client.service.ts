import { ApplicationContext } from "@/src/entities/models/application-context";
import type { Bundle } from "fhir/r4";
import type {
  IOceanClientService,
  OceanClientCredentials
} from "@/src/application/services/ocean-client.service.interface";
import { getOceanServerUrl } from "@/src/application/services/ocean-server.utils";
import {
  AuthorizationError,
  ConfigurationError,
  IOError
} from "@/src/entities/errors/common";

type Dependencies = {
  cxt: ApplicationContext;
};

type OceanClientConnectionInfo = OceanClientCredentials & {
  oceanSiteNum: string;
};

export const createOceanClientService = ({
                                           cxt
                                         }: Dependencies): IOceanClientService => {
  async function fetchOceanClientCredentials(): Promise<OceanClientConnectionInfo> {
    const siteConfiguration = await cxt
      .getSiteConfigurationRepository()
      .getForTenant();
    if (!siteConfiguration) {
      throw new ConfigurationError(
        `No site configuration found for tenant ${cxt.getTenantId()}`
      );
    }
    return {
      oceanServer: siteConfiguration.oceanServer,
      oceanSiteNum: siteConfiguration.oceanSiteNum,
      oceanClientId: siteConfiguration.oceanClientId,
      oceanClientSecret: siteConfiguration.oceanClientSecret
    };
  }

  async function retrieveAccessToken(
    credentials: OceanClientCredentials
  ): Promise<string> {
    const tokenUrl =
      new URL(getOceanServerUrl(credentials.oceanServer)).origin +
      "/svc/oauth2/token";
    try {
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `grant_type=client_credentials&client_id=${credentials.oceanClientId}&client_secret=${credentials.oceanClientSecret}`
      });
      if (!tokenResponse.ok) {
        throw new Error(
          "Failed to retrieve access token: " + tokenResponse.statusText
        );
      }
      const tokenData = await tokenResponse.json();
      return tokenData.access_token;
    } catch (error) {
      throw new Error("Failed to retrieve access token: " + error);
    }
  }

  async function sendMessage({
                               message,
                               credentials,
                               version
                             }: {
    message: Bundle;
    credentials?: OceanClientCredentials;
    version?: "v11" | "v12";
  }): Promise<Response> {
    if (!credentials) credentials = await fetchOceanClientCredentials();
    const token = await retrieveAccessToken(credentials);
    if (!token) {
      throw new Error("Failed to retrieve access token");
    }
    const path = `/svc/fhir/v1/$process-messages`;

    // log the message header:
    cxt.logger.info(
      `Sending message to Ocean, ${message.entry
        ?.filter((e) => e.resource?.resourceType === "MessageHeader")
        .map((e) => e.resource?.id)
        .join(", ")}`
    );

    const result = await fetch(
      `${getOceanServerUrl(credentials.oceanServer)}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/fhir+json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(message)
      }
    );
    const includeResult = cxt.logger.level === "debug";
    if (includeResult) {
      cxt.logger.info(`Sent message to Ocean: ${result.status}`, { result });
    } else {
      cxt.logger.info(`Sent message to Ocean: ${result.status}`);
    }
    return result;
  }

  async function fetchLetterData({
                                   letterUrl,
                                   credentials
                                 }: {
    letterUrl: string;
    credentials: OceanClientCredentials;
  }): Promise<Buffer<ArrayBufferLike>> {
    try {
      const accessToken = await retrieveAccessToken(credentials);
      const apiResponse = await fetch(letterUrl, {
        headers: {
          "Content-Type": "application/fhir+json;charset=UTF-8",
          Authorization: `Bearer ${accessToken}`
        }
      });

      const data = Buffer.from(await apiResponse.arrayBuffer());
      return data;
    } catch (err) {
      throw new IOError(`Error fetching letter data: ${err}`);
    }
  }

  async function testConnection(
    credentials: OceanClientCredentials
  ): Promise<Response> {
    const token = await retrieveAccessToken({
      oceanServer: credentials.oceanServer,
      oceanClientId: credentials.oceanClientId,
      oceanClientSecret: credentials.oceanClientSecret
    });
    if (!token) {
      throw new AuthorizationError("Failed to retrieve access token");
    }

    return await fetch(
      `${getOceanServerUrl(
        credentials.oceanServer
      )}/svc/fhir/v1/NamingSystem/id-site-number`,
      {
        method: "GET",
        headers: {
          Accept: "application/fhir+json",
          Authorization: `Bearer ${token}`
        }
      }
    );
  }

  return {
    fetchOceanClientCredentials,
    sendMessage,
    testConnection,
    fetchLetterData
  };
};
