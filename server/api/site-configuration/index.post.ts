import {
  newSiteConfigurationSchema,
  updateSiteConfigurationSchema,
} from "@/src/entities/models/site-configuration";
import { uuid } from "@/src/entities/models/uuid";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { assertTenantAdmin } from "@/server/utils/tenant-access";
export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const body = (await readBody<Record<string, unknown>>(event)) ?? {};
  const user = cxt.getUser();
  const tenantId = cxt.getTenantId();

  if (!tenantId || !user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "An active tenant is required",
    });
  }

  if (user.roles.admin !== "system") {
    await assertTenantAdmin({ tenantId, userId: user.id });
  }

  try {
    const existingConfig = await cxt
      .getSiteConfigurationRepository()
      .getForTenant();
    const normalizedBody = normalizeSiteConfigurationBody(body, existingConfig);

    if (existingConfig) {
      const siteConfig = updateSiteConfigurationSchema.parse(normalizedBody);
      if (siteConfig.id !== existingConfig.id) {
        throw createError({
          statusCode: 400,
          data: "Id mismatch",
        });
      }
      await cxt.getSiteConfigurationRepository().update(siteConfig);
    } else {
      const siteConfig = newSiteConfigurationSchema.parse(normalizedBody);

      await cxt.getSiteConfigurationRepository().create(siteConfig);
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

function normalizeSiteConfigurationBody(
  body: Record<string, unknown>,
  existingConfig: { clientSecret: string } | null,
): Record<string, unknown> {
  const normalizedBody = { ...body };
  const clientSecret =
    typeof normalizedBody.clientSecret === "string"
      ? normalizedBody.clientSecret.trim()
      : undefined;

  if (clientSecret && clientSecret.length > 0) {
    normalizedBody.clientSecret = clientSecret;
    return normalizedBody;
  }

  if (existingConfig?.clientSecret?.trim()) {
    delete normalizedBody.clientSecret;
    return normalizedBody;
  }

  normalizedBody.clientSecret = uuid();
  return normalizedBody;
}
