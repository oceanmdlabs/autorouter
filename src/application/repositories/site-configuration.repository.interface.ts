import type {
  SiteConfiguration,
  UpdateSiteConfiguration,
  NewSiteConfiguration,
  SiteConfigurationReference,
} from "@/src/entities/models/site-configuration";

export interface ISiteConfigurationRepository {
  getAll(): Promise<SiteConfigurationReference[]>;
  getForTenant(): Promise<SiteConfiguration | null>;
  findByClientId(clientId: string): Promise<SiteConfiguration | null>;
  // Called during OAuth2 token issuance — no tenant context is available at that point.
  recordSuccessfulConnection(id: string): Promise<void>;
  create(service: NewSiteConfiguration): Promise<void>;
  update(service: UpdateSiteConfiguration): Promise<void>;
}
