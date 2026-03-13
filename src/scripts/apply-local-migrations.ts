import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import {
  assertDbUrlIsLocal,
  getDbUrl,
  getMigrationsFolder,
} from "./db-migration-guard";

const { Pool } = pg;

async function main() {
  const dbUrl = getDbUrl();
  const parsed = assertDbUrlIsLocal(dbUrl);
  const migrationsFolder = getMigrationsFolder();
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.info(
      `Applied committed migrations to local database "${parsed.pathname.replace(/^\//, "")}".`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
