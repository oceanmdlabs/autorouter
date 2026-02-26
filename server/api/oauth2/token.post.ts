import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);
  const siteConfig = await cxt
    .getSiteConfigurationRepository()
    .findByClientId(body.client_id);
  if (!siteConfig) {
    throw createError({
      statusCode: 400,
      data: "Site configuration not found",
    });
  }
  const cryptoService = cxt.getCryptoService();
  const isValid =
    siteConfig.clientSecret && siteConfig.clientSecret === body.client_secret;
  if (!isValid) {
    throw createError({
      statusCode: 400,
      data: "Invalid client secret",
    });
  }

  const accessToken = cryptoService.generateJWT({
    sub: siteConfig.id,
    clientId: siteConfig.clientId,
    tenantId: siteConfig.tenantId,
    iat: Math.floor(Date.now() / 1000),
  });

  cxt.getSiteConfigurationRepository().update({
    id: siteConfig.id,
    lastSuccessfulConnection: new Date(),
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
  };
});
