import { systemAdminAllowlist } from "@/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";

export type IdentityProvider = "google" | "github";

let dbClient: ReturnType<typeof createDbClient> | null = null;

function getDbClient() {
  if (!dbClient) {
    dbClient = createDbClient();
  }
  return dbClient;
}

async function hasDbSystemAdmin(
  provider: IdentityProvider,
  subject: string
): Promise<boolean> {
  try {
    const db = getDbClient();
    const result = await db
      .select({ id: systemAdminAllowlist.id })
      .from(systemAdminAllowlist)
      .where(
        and(
          sql`${systemAdminAllowlist.provider} = ${provider}::identity_provider`,
          eq(systemAdminAllowlist.subject, subject),
          eq(systemAdminAllowlist.active, true)
        )
      )
      .limit(1);
    return result.length > 0;
  } catch (error) {
    console.warn("System admin DB allowlist lookup failed.", error);
    return false;
  }
}

export async function isSystemAdmin(
  provider: IdentityProvider,
  subject: string
): Promise<boolean> {
  if (!subject) return false;
  return hasDbSystemAdmin(provider, subject);
}
