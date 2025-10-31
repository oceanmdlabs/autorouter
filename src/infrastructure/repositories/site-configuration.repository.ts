import { ApplicationContext } from "@/src/entities/models/application-context";
import { eq } from "drizzle-orm";
import { siteConfig } from "@/drizzle/schema";
import type {
  SiteConfiguration,
  UpdateSiteConfiguration,
  SiteConfigurationReference,
} from "@/src/entities/models/site-configuration";
import type { ISiteConfigurationRepository } from "@/src/application/repositories/site-configuration.repository.interface";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createSiteConfigurationRepository = ({
  cxt,
}: Dependencies): ISiteConfigurationRepository => {
  const dbService = cxt.getDbService();
  const cryptoService = cxt.getCryptoService();

  function mapToEntity(
    dbRecord: typeof siteConfig.$inferSelect | null
  ): SiteConfiguration | null {
    if (!dbRecord) return null;
    const {
      clientSecretEncrypted,
      oceanClientSecretEncrypted,
      aiApiKeyEncrypted,
      emailApiKeyEncrypted,
      ...rest
    } = dbRecord;
    return {
      ...rest,
      clientSecret: cryptoService.decrypt(clientSecretEncrypted),
      oceanClientSecret: cryptoService.decrypt(oceanClientSecretEncrypted),
      aiApiKey: aiApiKeyEncrypted
        ? cryptoService.decrypt(aiApiKeyEncrypted)
        : undefined,
      emailApiKey: emailApiKeyEncrypted
        ? cryptoService.decrypt(emailApiKeyEncrypted)
        : undefined,
    };
  }
  function mapToDbRecord(record: SiteConfiguration) {
    const { clientSecret, oceanClientSecret, aiApiKey, emailApiKey, ...rest } =
      record;
    return {
      ...rest,
      clientSecretEncrypted: cryptoService.encrypt(clientSecret),
      oceanClientSecretEncrypted: cryptoService.encrypt(oceanClientSecret),
      ...(aiApiKey && {
        aiApiKeyEncrypted: cryptoService.encrypt(aiApiKey),
      }),
      ...(emailApiKey && {
        emailApiKeyEncrypted: cryptoService.encrypt(emailApiKey),
      }),
    };
  }

  function mapToDbRecordForUpdate(record: UpdateSiteConfiguration) {
    const { clientSecret, oceanClientSecret, aiApiKey, emailApiKey, ...rest } =
      record;
    const result: Record<string, any> = { ...rest };

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

    return result;
  }

  return {
    async getAll(): Promise<SiteConfigurationReference[]> {
      const records = await dbService.findMany(siteConfig, {
        where: undefined,
      });
      return records.map((record) => ({
        id: record.id,
        name: record.name,
        tenantId: record.tenantId,
      }));
    },

    async getForTenant(): Promise<SiteConfiguration | null> {
      const record = await dbService.findFirst(siteConfig, {
        where: undefined,
      });
      return mapToEntity(record);
    },

    async findByClientId(clientId: string): Promise<SiteConfiguration | null> {
      const record = await dbService.findFirst(siteConfig, {
        where: eq(siteConfig.clientId, clientId),
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
  };
};
