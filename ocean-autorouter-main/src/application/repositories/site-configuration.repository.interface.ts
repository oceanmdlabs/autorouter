import type {
  SiteConfiguration,
  UpdateSiteConfiguration,
  NewSiteConfiguration,
  SiteConfigurationReference,
} from "@/src/entities/models/site-configuration";

/**
 * Asymmetric key material stored in site_config for Zero-Knowledge encryption
 *
 * Uses RSA asymmetric encryption:
 * - publicKey: Used for encrypting per-row DEKs (can be used anytime)
 * - encryptedPrivateKey: Private key encrypted by clinic secret (for decryption)
 *
 * This allows:
 * - Automated processes to encrypt PHI anytime using the public key
 * - Users to decrypt PHI only after entering clinic secret to unlock private key
 */
export interface TenantEncryptionMaterial {
  /** RSA Public Key in PEM format - used for encrypting per-row DEKs */
  publicKey: string | null;
  /** RSA Private Key encrypted with clinic secret using AES-GCM */
  encryptedPrivateKey: Buffer | null;
  /** IV for private key encryption */
  privateKeyIv: Buffer | null;
  /** Auth tag for private key encryption */
  privateKeyTag: Buffer | null;
  /** Salt used for deriving encryption key from clinic secret */
  privateKeySalt: Buffer | null;
  /** Whether encryption has been provisioned for this tenant */
  isEncryptedSetup: boolean;
}

/**
 * Reference for tenants pending encryption provisioning
 */
export interface TenantEncryptionStatus extends SiteConfigurationReference {
  isEncryptedSetup: boolean;
}

export interface ISiteConfigurationRepository {
  getAll(): Promise<SiteConfigurationReference[]>;
  getForTenant(): Promise<SiteConfiguration | null>;
  getSiteIdForTenant(): Promise<string | null>;
  findByClientId(clientId: string): Promise<SiteConfiguration | null>;
  create(service: NewSiteConfiguration): Promise<void>;
  update(service: UpdateSiteConfiguration): Promise<void>;

  // Encryption provisioning methods
  getAllEncryptionStatus(): Promise<TenantEncryptionStatus[]>;
  getEncryptionMaterial(siteId: string): Promise<TenantEncryptionMaterial | null>;
  saveEncryptionMaterial(siteId: string, material: TenantEncryptionMaterial): Promise<void>;
}
