import { AppInitializationError } from "@/src/entities/errors/common";

export type OceanServer = "ocean" | "test" | "staging" | "local";

export function getOceanServerUrl(server: OceanServer): string {
  switch (server) {
    case "ocean":
      return "https://ocean.cognisantmd.com";
    case "test":
      return "https://test.cognisantmd.com";
    case "staging":
      return "https://staging.cognisantmd.com";
    case "local":
      return "http://localhost:8080";
    default:
      return "https://ocean.cognisantmd.com";
  }
}

export function getDeployUrl() {
  const url = process.env.URL ?? process.env.DEPLOY_URL;
  if (!url) {
    throw new AppInitializationError("URL and DEPLOY_URL is not set");
  }
  return url;
}

export function getSourceEndpoint(): string {
  return process.env.DEPLOY_URL + "/api/fhir/$process-messages";
}

export function getReferralUrl(
  referralRef: string,
  oceanSiteNum: string,
  oceanServer: OceanServer = "ocean"
): string | undefined {
  if (!referralRef || !oceanSiteNum) return undefined;
  return `${getOceanServerUrl(oceanServer)}/ocean/portal.html?siteNum=${oceanSiteNum}#/referrals/${referralRef}/edit`;
}
