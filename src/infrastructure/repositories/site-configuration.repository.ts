import type { ApplicationContext } from "@/src/entities/models/application-context";
import { eq, sql } from "drizzle-orm";
import { aiProviderEnum, oceanServerEnum, siteConfig } from "@/drizzle/schema";
import type {
  SiteConfiguration,
  UpdateSiteConfiguration,
  SiteConfigurationReference,
} from "@/src/entities/models/site-configuration";
import type { ISiteConfigurationRepository } from "@/src/application/repositories/site-configuration.repository.interface";

type Dependencies = {
  cxt: ApplicationContext;
};

function oceanServerValue(server: (typeof oceanServerEnum.enumValues)[number]) {
  return sql`${server}::ocean_server`;
}

function aiProviderValue(provider: (typeof aiProviderEnum.enumValues)[number] | null) {
  return provider === null ? null : sql`${provider}::ai_provider`;
}

export const createSiteConfigurationRepository = ({
  cxt,
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
      webhookKeyEncrypted,
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
      ),
      webhookKey: decrypt(webhookKeyEncrypted, "webhookKey"),
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
      webhookKey,
      ...rest
    } = record;
    return {
      ...rest,
      oceanServer: oceanServerValue(rest.oceanServer),
      aiProvider:
        rest.aiProvider === undefined ? undefined : aiProviderValue(rest.aiProvider),
      clientSecretEncrypted: cryptoService.encrypt(clientSecret),
      oceanClientSecretEncrypted: cryptoService.encrypt(oceanClientSecret),
      ...(aiApiKey && {
        aiApiKeyEncrypted: cryptoService.encrypt(aiApiKey),
      }),
      ...(emailApiKey && {
        emailApiKeyEncrypted: cryptoService.encrypt(emailApiKey),
      }),
      ...(siteKey && {
        siteKeyEncrypted: cryptoService.encrypt(siteKey),
      }),
      ...(siteCredential && {
        siteCredentialEncrypted: cryptoService.encrypt(siteCredential),
      }),
      ...(sharedEncryptionKey && {
        sharedEncryptionKeyEncrypted:
          cryptoService.encrypt(sharedEncryptionKey),
      }),
      ...(webhookKey && {
        webhookKeyEncrypted: cryptoService.encrypt(webhookKey),
      }),
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
      webhookKey,
      ...rest
    } = record;
    const result: Record<string, unknown> = { ...rest };

    if (rest.oceanServer != null) {
      result.oceanServer = oceanServerValue(rest.oceanServer);
    }
    if (rest.aiProvider !== undefined) {
      result.aiProvider = aiProviderValue(rest.aiProvider);
    }

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
    if (webhookKey != null) {
      result.webhookKeyEncrypted = cryptoService.encrypt(webhookKey);
    }

    return result;
  }

  return {
    async getAll(): Promise<SiteConfigurationReference[]> {
      const records = await dbService.findMany(siteConfig, {
        where: undefined, // No additional filtering needed, tenant filtering is automatic
      });
      return records.map((record) => ({
        id: record.id,
        name: record.name,
        tenantId: record.tenantId,
      }));
    },

    async getForTenant(): Promise<SiteConfiguration | null> {
      const record = await dbService.findFirst(siteConfig);
      return mapToEntity(record);
    },

    async findByClientId(clientId: string): Promise<SiteConfiguration | null> {
      // Must use findFirstUnscoped here: this method is called during OAuth2 token
      // issuance to validate client credentials before any tenant context exists.
      // The tenant ID is unknown at this point — it's derived from the site config
      // record itself. client_id is globally unique, so no tenant filter is needed.
      const record = await dbService.findFirstUnscoped(siteConfig, {
        where: eq(siteConfig.clientId, clientId),
      });
      return mapToEntity(record);
    },

    async recordSuccessfulConnection(id: string): Promise<void> {
      // Must use updateUnscoped: called during OAuth2 token issuance before any
      // tenant context exists. The record ID is already known and specific enough
      // to be safe without a tenant filter.
      await dbService.updateUnscoped(
        siteConfig,
        { lastSuccessfulConnection: new Date() },
        eq(siteConfig.id, id)
      );
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
  };
};
