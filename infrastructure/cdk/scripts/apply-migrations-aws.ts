import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { migrate } from "drizzle-orm/aws-data-api/pg/migrator";

function runAwsJson(args: string[], env: NodeJS.ProcessEnv): unknown {
  const output = execFileSync("aws", [...args, "--output", "json"], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

function getLambdaEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const stackName = env.CDK_STACK_NAME ?? "dev";
  const fullStackName = `${stackName}-autorouter`;

  const stack = runAwsJson(
    ["cloudformation", "describe-stacks", "--stack-name", fullStackName],
    env
  ) as {
    Stacks?: Array<{
      Outputs?: Array<{ OutputKey?: string; OutputValue?: string }>;
    }>;
  };

  const outputs = stack.Stacks?.[0]?.Outputs ?? [];
  const lambdaName = outputs.find((x) => x.OutputKey === "lambdaName")?.OutputValue;
  if (!lambdaName) {
    throw new Error(`Could not find 'lambdaName' output in stack '${fullStackName}'.`);
  }

  const cfg = runAwsJson(
    ["lambda", "get-function-configuration", "--function-name", lambdaName],
    env
  ) as {
    Environment?: { Variables?: Record<string, string> };
  };

  return cfg.Environment?.Variables ?? {};
}

async function main() {
  const scriptDir = fileURLToPath(new URL(".", import.meta.url));
  const repoRoot = resolve(scriptDir, "../../..");

  dotenv.config();
  dotenv.config({ path: resolve(repoRoot, "infrastructure/cdk/.env.deploy"), override: false });

  const env = { ...process.env };
  const awsRegion = env.AWS_REGION;
  if (!awsRegion) {
    throw new Error("AWS_REGION is required (set in environment or infrastructure/cdk/.env.deploy).");
  }

  const migrationsFolder = resolve(repoRoot, "drizzle/migrations");
  if (!existsSync(migrationsFolder)) {
    throw new Error(
      `Migrations folder not found: ${migrationsFolder}. Generate migrations first with 'npm run db:migrate:generate'.`
    );
  }

  const lambdaEnv = getLambdaEnv(env);
  if (lambdaEnv.DB_DRIVER !== "aws-data-api-pg") {
    throw new Error(
      "This environment is not configured for Aurora Data API (DB_DRIVER=aws-data-api-pg). " +
        "Run migrations from inside VPC for direct RDS connectivity, or deploy with dbUseDataApi=true."
    );
  }

  const resourceArn = lambdaEnv.DB_RESOURCE_ARN;
  const secretArn = lambdaEnv.DB_SECRET_ARN;
  const database = lambdaEnv.DB_NAME;

  if (!resourceArn || !secretArn || !database) {
    throw new Error(
      "Missing one or more required DB env vars on Lambda: DB_RESOURCE_ARN, DB_SECRET_ARN, DB_NAME."
    );
  }

  const client = new RDSDataClient({ region: awsRegion });
  const db = drizzle(client, {
    database,
    resourceArn,
    secretArn,
  });

  await migrate(db, { migrationsFolder });
  console.info(`Applied migrations from ${migrationsFolder}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
