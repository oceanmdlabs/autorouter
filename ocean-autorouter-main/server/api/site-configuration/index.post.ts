import {
  newSiteCreationRequestSchema,
  updateSiteConfigurationSchema,
} from "@/src/entities/models/site-configuration";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const body = await readBody(event);

  try {
    const existingConfig = await cxt
      .getSiteConfigurationRepository()
      .getForTenant();

    if (existingConfig) {
      // Updating existing configuration - no clinic secret needed
      const siteConfig = updateSiteConfigurationSchema.parse(body);
      if (siteConfig.id !== existingConfig.id) {
        throw createError({
          statusCode: 400,
          data: "Id mismatch",
        });
      }
      await cxt.getSiteConfigurationRepository().update(siteConfig);
    } else {
      // Creating new configuration - requires clinic secret for encryption
      const requestData = newSiteCreationRequestSchema.parse(body);
      const { clinicSecret, ...configWithoutSecret } = requestData;

      // Create the site configuration first
      await cxt.getSiteConfigurationRepository().create(configWithoutSecret);

      // Provision asymmetric encryption using the clinic secret
      const phiCrypto = cxt.getPhiCryptoService();
      const siteConfigRepo = cxt.getSiteConfigurationRepository();

      // Get the newly created site config to get its ID
      const createdConfig = await siteConfigRepo.getForTenant();
      if (!createdConfig) {
        throw createError({
          statusCode: 500,
          data: "Failed to retrieve newly created site configuration",
        });
      }

      // Generate RSA key pair and encrypt private key with clinic secret
      const provisioningResult = await phiCrypto.provisionTenant(clinicSecret);

      // Save the encryption material
      await siteConfigRepo.saveEncryptionMaterial(createdConfig.id, {
        publicKey: provisioningResult.publicKey,
        encryptedPrivateKey: provisioningResult.encryptedPrivateKey.encryptedKey,
        privateKeyIv: provisioningResult.encryptedPrivateKey.iv,
        privateKeyTag: provisioningResult.encryptedPrivateKey.tag,
        privateKeySalt: provisioningResult.encryptedPrivateKey.salt,
        isEncryptedSetup: true
      });

      cxt.logger.info(`Encryption provisioned for new site ${createdConfig.id}`);
    }

    return await cxt.getSiteConfigurationRepository().getForTenant();
  } catch (error) {
    cxt.logger.error(error);
    throw createError({
      statusCode: 400,
      data: error,
    });
  }
});
