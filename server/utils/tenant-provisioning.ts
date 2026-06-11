import { siteConfig, tenantMemberships } from "@/drizzle/schema";
import { uuid } from "@/src/entities/models/uuid";
import { createCryptoService } from "@/src/infrastructure/services/crypto.service";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { and, eq } from "drizzle-orm";
import { membershipRoleValue, membershipStatusValue, oceanServerValue } from "./db-enum-helpers";

export async function isKnownTenant(tenantId: string) {
  const db = createDbClient();
  const tenant = await db.query.siteConfig.findFirst({
    where: eq(siteConfig.tenantId, tenantId),
    columns: { id: true },
  });
  return Boolean(tenant);
}

export async function createTenantSiteConfiguration(args: {
  tenantId: string;
  name: string;
  userId: string;
}) {
  const db = createDbClient();
  const existingTenant = await db.query.siteConfig.findFirst({
    where: eq(siteConfig.tenantId, args.tenantId),
    columns: { id: true },
  });

  if (existingTenant) {
    throw createError({
      statusCode: 409,
      statusMessage: "Tenant already exists",
    });
  }

  const now = new Date();
  const cryptoService = createCryptoService({});
  const clientSecret = uuid();

  await db.insert(siteConfig).values({
    id: uuid(),
    tenantId: args.tenantId,
    name: args.name,
    clientId: uuid(),
    clientSecretEncrypted: cryptoService.encrypt(clientSecret),
    oceanServer: oceanServerValue("ocean"),
    oceanSiteNum: "",
    oceanClientId: "",
    oceanClientSecretEncrypted: "",
    createdAt: now,
    createdBy: args.userId,
    updatedAt: now,
    updatedBy: args.userId,
  });

  const existingMembership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.tenantId, args.tenantId),
      eq(tenantMemberships.userId, args.userId)
    ),
    columns: { id: true },
  });

  if (existingMembership) {
    await db
      .update(tenantMemberships)
      .set({
        role: membershipRoleValue("admin"),
        status: membershipStatusValue("active"),
        updatedAt: now,
        updatedBy: args.userId,
        revokedAt: null,
        revokedBy: null,
      })
      .where(eq(tenantMemberships.id, existingMembership.id));
  } else {
    await db.insert(tenantMemberships).values({
      id: uuid(),
      tenantId: args.tenantId,
      userId: args.userId,
      role: membershipRoleValue("admin"),
      status: membershipStatusValue("active"),
      createdAt: now,
      createdBy: args.userId,
      updatedAt: now,
      updatedBy: args.userId,
    });
  }
}
