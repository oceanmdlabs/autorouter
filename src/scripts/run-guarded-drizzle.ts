import { spawn } from "node:child_process";
import path from "node:path";

import { assertLocalDbMatchesRepoMigrations } from "./db-migration-guard";

async function main() {
  const command = process.argv[2];
  const extraArgs = process.argv.slice(3);

  if (!command || !["generate", "push"].includes(command)) {
    throw new Error("Usage: tsx src/scripts/run-guarded-drizzle.ts <generate|push> [...args]");
  }

  if (command === "push" && process.env.ALLOW_DRIZZLE_PUSH !== "1") {
    throw new Error(
      "Refusing to run drizzle-kit push without ALLOW_DRIZZLE_PUSH=1. Use SQL migrations for normal schema changes."
    );
  }

  const { dbName, migrationCount } = await assertLocalDbMatchesRepoMigrations();
  console.info(
    `Validated ${migrationCount} committed migration(s) against local database "${dbName}".`
  );

  const drizzleCliPath = path.resolve("node_modules", "drizzle-kit", "bin.cjs");
  const child = spawn(process.execPath, [drizzleCliPath, command, ...extraArgs], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
