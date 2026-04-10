import type { ApplicationContext } from "@/src/entities/models/application-context";
import { eq } from "drizzle-orm";
import { siteConfig } from "@/drizzle/schema";
import type {
  SiteConfiguration,
  UpdateSiteConfiguration,
  SiteConfigurationReference
} from "@/src/entities/models/site-configuration";
import type {
  ISiteConfigurationRepository,
  TenantEncryptionMaterial,
  TenantEncryptionStatus
} from "@/src/application/repositories/site-configuration.repository.interface";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createSiteConfigurationRepository = ({
                                                    cxt
                                                  }: Dependencies): ISiteConfigurationRepository => {
  const dbService = cxt.getDbService();
  const cryptoService = cxt.getCryptoService();

  function mapToEntity(
    dbRecord: typeof siteConfig.$inferSelect | null
  ): SiteConfiguration | null {
    if (!dbRecord) return null;

    // Proxy function to handle decryption errors gracefully
    const decrypt = (
      encryptedValue: string | null,
      fieldName: string
    ): string => {
      if (!encryptedValue) return "";
      try {
        return cryptoService.decrypt(encryptedValue);
      } catch (error) {
        console.warn(`Failed to decrypt field '${fieldName}':`, error);
        return "";
      }
    };

    const {
      clientSecretEncrypted,
      oceanClientSecretEncrypted,
      aiApiKeyEncrypted,
      emailApiKeyEncrypted,
      siteKeyEncrypted,
      siteCredentialEncrypted,
      sharedEncryptionKeyEncrypted,
      ...rest
    } = dbRecord;
    return {
      ...rest,
      clientSecret: decrypt(clientSecretEncrypted, "clientSecret"),
      oceanClientSecret: decrypt(
        oceanClientSecretEncrypted,
        "oceanClientSecret"
      ),
      aiApiKey: decrypt(aiApiKeyEncrypted, "aiApiKey"),
      emailApiKey: decrypt(emailApiKeyEncrypted, "emailApiKey"),
      siteKey: decrypt(siteKeyEncrypted, "siteKey"),
      siteCredential: decrypt(siteCredentialEncrypted, "siteCredential"),
      sharedEncryptionKey: decrypt(
        sharedEncryptionKeyEncrypted,
        "sharedEncryptionKey"
      )
    };
  }

  function mapToDbRecord(record: SiteConfiguration) {
    const {
      clientSecret,
      oceanClientSecret,
      aiApiKey,
      emailApiKey,
      siteKey,
      siteCredential,
      sharedEncryptionKey,
      ...rest
    } = record;
    return {
      ...rest,
      clientSecretEncrypted: cryptoService.encrypt(clientSecret),
      oceanClientSecretEncrypted: cryptoService.encrypt(oceanClientSecret),
      ...(aiApiKey && {
        aiApiKeyEncrypted: cryptoService.encrypt(aiApiKey)
      }),
      ...(emailApiKey && {
        emailApiKeyEncrypted: cryptoService.encrypt(emailApiKey)
      }),
      ...(siteKey && {
        siteKeyEncrypted: cryptoService.encrypt(siteKey)
      }),
      ...(siteCredential && {
        siteCredentialEncrypted: cryptoService.encrypt(siteCredential)
      }),
      ...(sharedEncryptionKey && {
        sharedEncryptionKeyEncrypted:
          cryptoService.encrypt(sharedEncryptionKey)
      })
    };
  }

  function mapToDbRecordForUpdate(record: UpdateSiteConfiguration) {
    const {
      clientSecret,
      oceanClientSecret,
      aiApiKey,
      emailApiKey,
      siteKey,
      siteCredential,
      sharedEncryptionKey,
      ...rest
    } = record;
    const result: Record<string, unknown> = { ...rest };

    if (clientSecret != null) {
      result.clientSecretEncrypted = cryptoService.encrypt(clientSecret);
    }
    if (oceanClientSecret != null) {
      result.oceanClientSecretEncrypted =
        cryptoService.encrypt(oceanClientSecret);
    }
    if (aiApiKey != null) {
      result.aiApiKeyEncrypted = cryptoService.encrypt(aiApiKey);
    }
    if (emailApiKey != null) {
      result.emailApiKeyEncrypted = cryptoService.encrypt(emailApiKey);
    }
    if (siteKey != null) {
      result.siteKeyEncrypted = cryptoService.encrypt(siteKey);
    }
    if (siteCredential != null) {
      result.siteCredentialEncrypted = cryptoService.encrypt(siteCredential);
    }
    if (sharedEncryptionKey != null) {
      result.sharedEncryptionKeyEncrypted =
        cryptoService.encrypt(sharedEncryptionKey);
    }

    return result;
  }

  return {
    async getAll(): Promise<SiteConfigurationReference[]> {
      const records = await dbService.findManyGlobal(siteConfig);
      if (!records) {
        cxt.logger.warn(`No site configurations found`);
        return [];
      }

      cxt.logger.warn(`Fetched ${records.length} site configurations`);
      return records.map((record) => ({
        id: record.id,
        name: record.name,
        tenantId: record.tenantId
      }));
    },

    async getForTenant(): Promise<SiteConfiguration | null> {
      const record = await dbService.findFirst(siteConfig);
      return mapToEntity(record);
    },

    async getSiteIdForTenant(): Promise<string | null> {
      const record = await dbService.findFirst(siteConfig);
      return record?.id ?? null;
    },

    async findByClientId(clientId: string): Promise<SiteConfiguration | null> {
      const record = await dbService.findFirst(siteConfig, {
        where: eq(siteConfig.clientId, clientId)
      });
      return mapToEntity(record);
    },

    async create(record: SiteConfiguration) {
      await dbService.insert(
        siteConfig,
        dbService.initMetadataAndTenant(mapToDbRecord(record))
      );
    },

    async update(record: UpdateSiteConfiguration) {
      const dbRecord = mapToDbRecordForUpdate(record);
      dbService.updateMetadata(dbRecord);
      await dbService.update(
        siteConfig,
        dbRecord,
        eq(siteConfig.id, record.id)
      );
    },

    async getAllEncryptionStatus(): Promise<TenantEncryptionStatus[]> {
      const records = await dbService.findManyGlobal(siteConfig);
      if (!records) {
        return [];
      }
      return records.map((record) => ({
        id: record.id,
        name: record.name,
        tenantId: record.tenantId,
        isEncryptedSetup: record.isEncryptedSetup ?? false
      }));
    },

    async getEncryptionMaterial(siteId: string): Promise<TenantEncryptionMaterial | null> {
      const record = await dbService.findFirstGlobal(siteConfig, {
        where: eq(siteConfig.id, siteId)
      });
      if (!record) {
        return null;
      }
      return {
        publicKey: record.publicKey,
        encryptedPrivateKey: record.encryptedPrivateKey,
        privateKeyIv: record.privateKeyIv,
        privateKeyTag: record.privateKeyTag,
        privateKeySalt: record.privateKeySalt,
        isEncryptedSetup: record.isEncryptedSetup ?? false
      };
    },

    async saveEncryptionMaterial(siteId: string, material: TenantEncryptionMaterial): Promise<void> {
      await dbService.updateGlobal(
        siteConfig,
        {
          publicKey: material.publicKey,
          encryptedPrivateKey: material.encryptedPrivateKey,
          privateKeyIv: material.privateKeyIv,
          privateKeyTag: material.privateKeyTag,
          privateKeySalt: material.privateKeySalt,
          isEncryptedSetup: material.isEncryptedSetup,
          updatedAt: new Date(),
          updatedBy: cxt.getUser()?.id ?? "system"
        },
        eq(siteConfig.id, siteId)
      );
    }
  };
};
