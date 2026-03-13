import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;

const LOCAL_DB_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

type RepoMigration = {
  tag: string;
  hash: string;
};

type AppliedMigration = {
  id: number;
  hash: string;
  createdAt: number;
};

function getRepoRoot() {
  return path.resolve(import.meta.dirname, "../..");
}

export function getMigrationsFolder() {
  return path.join(getRepoRoot(), "drizzle", "migrations");
}

export function getDbUrl() {
  const dbUrl = process.env.DB_URL;

  if (!dbUrl) {
    throw new Error(
      "DB_URL is required. Point it at a dedicated local Postgres database before running schema commands."
    );
  }

  return dbUrl;
}

export function assertDbUrlIsLocal(dbUrl = getDbUrl()) {
  const parsed = new URL(dbUrl);

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`DB_URL must use postgres:// or postgresql://. Received: ${parsed.protocol}`);
  }

  if (!LOCAL_DB_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Refusing to run against non-local database host "${parsed.hostname}". Use a dedicated local Postgres instance for schema work.`
    );
  }

  return parsed;
}

export function getRepoMigrations(): RepoMigration[] {
  const migrationsFolder = getMigrationsFolder();
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");

  if (!fs.existsSync(journalPath)) {
    throw new Error(`Migration journal not found: ${journalPath}`);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };

  return journal.entries.map((entry) => {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file referenced by journal is missing: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, "utf8");

    return {
      tag: entry.tag,
      hash: crypto.createHash("sha256").update(sql).digest("hex"),
    };
  });
}

export async function fetchAppliedMigrations(dbUrl = getDbUrl()) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const existsResult = await client.query<{
      exists: boolean;
    }>(
      `select exists (
        select 1
        from information_schema.tables
        where table_schema = 'drizzle'
          and table_name = '__drizzle_migrations'
      ) as exists;`
    );

    if (!existsResult.rows[0]?.exists) {
      return [] as AppliedMigration[];
    }

    const appliedResult = await client.query<{
      id: number;
      hash: string;
      created_at: string | number;
    }>(
      `select id, hash, created_at
       from drizzle.__drizzle_migrations
       order by created_at asc, id asc;`
    );

    return appliedResult.rows.map((row) => ({
      id: Number(row.id),
      hash: row.hash,
      createdAt: Number(row.created_at),
    }));
  } finally {
    await client.end();
  }
}

export async function assertLocalDbMatchesRepoMigrations() {
  const dbUrl = getDbUrl();
  const parsed = assertDbUrlIsLocal(dbUrl);
  const repoMigrations = getRepoMigrations();
  const appliedMigrations = await fetchAppliedMigrations(dbUrl);

  if (repoMigrations.length === 0) {
    return {
      dbName: parsed.pathname.replace(/^\//, ""),
      migrationCount: 0,
    };
  }

  if (appliedMigrations.length !== repoMigrations.length) {
    throw new Error(
      [
        `Local database is out of sync with committed migrations.`,
        `Repo migrations: ${repoMigrations.length}. Applied migrations in ${parsed.pathname.replace(/^\//, "")}: ${appliedMigrations.length}.`,
        "Rebuild or update the local database from committed migrations before generating or pushing schema changes.",
        "Recommended command: npm run db:migrate:apply:local",
      ].join(" ")
    );
  }

  for (const [index, repoMigration] of repoMigrations.entries()) {
    const appliedMigration = appliedMigrations[index];

    if (!appliedMigration || appliedMigration.hash !== repoMigration.hash) {
      throw new Error(
        [
          `Local database migration history does not match this branch at position ${index + 1}.`,
          `Expected ${repoMigration.tag} (${repoMigration.hash.slice(0, 12)}...), received ${appliedMigration?.hash.slice(0, 12) ?? "missing"}...`,
          "Do not generate or push schema changes from a drifted local database.",
          "Reset or reapply committed migrations, then rerun the command.",
        ].join(" ")
      );
    }
  }

  return {
    dbName: parsed.pathname.replace(/^\//, ""),
    migrationCount: repoMigrations.length,
  };
}

async function main() {
  const { dbName, migrationCount } = await assertLocalDbMatchesRepoMigrations();
  console.info(
    `Local database "${dbName}" matches ${migrationCount} committed migration(s).`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
