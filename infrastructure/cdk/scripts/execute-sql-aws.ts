import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { ExecuteStatementCommand, RDSDataClient } from "@aws-sdk/client-rds-data";

const MAX_RESUME_ATTEMPTS = 8;
const INITIAL_RESUME_DELAY_MS = 5_000;

type LambdaEnvResult = {
  database: string;
  resourceArn: string;
  secretArn: string;
};

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isAuroraResumeError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("resuming after being auto-paused") ||
    message.includes("db instance is resuming") ||
    message.includes("databaseresumingexception")
  );
}

async function waitForAuroraResume(params: {
  client: RDSDataClient;
  database: string;
  resourceArn: string;
  secretArn: string;
}) {
  let delayMs = INITIAL_RESUME_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_RESUME_ATTEMPTS; attempt += 1) {
    try {
      await params.client.send(
        new ExecuteStatementCommand({
          database: params.database,
          resourceArn: params.resourceArn,
          secretArn: params.secretArn,
          sql: "select 1",
        })
      );
      return;
    } catch (error) {
      if (!isAuroraResumeError(error) || attempt === MAX_RESUME_ATTEMPTS) {
        throw error;
      }

      console.info(
        `Aurora is still resuming from auto-pause. Waiting ${Math.round(
          delayMs / 1000
        )}s before retry ${attempt + 1}/${MAX_RESUME_ATTEMPTS}.`
      );
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}

function parseArgs(args: string[]) {
  let sql: string | undefined;
  let file: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--sql") {
      sql = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--file") {
      file = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if ((sql && file) || (!sql && !file)) {
    throw new Error("Provide exactly one of --sql \"...\" or --file path/to/query.sql.");
  }

  return { file, json, sql };
}

function printUsage() {
  console.info(
    [
      "Usage:",
      '  npm run db:sql:aws -- --sql "select now();" [--json]',
      "  npm run db:sql:aws -- --file /absolute/or/relative/path.sql [--json]",
    ].join("\n")
  );
}

function getSqlText(repoRoot: string, args: { file?: string; sql?: string }) {
  if (args.sql) {
    return args.sql;
  }

  const path = resolve(repoRoot, args.file!);
  if (!existsSync(path)) {
    throw new Error(`SQL file not found: ${path}`);
  }

  return readFileSync(path, "utf8");
}

function getFieldValue(
  field:
    | {
        arrayValue?: unknown;
        blobValue?: Uint8Array;
        booleanValue?: boolean;
        doubleValue?: number;
        isNull?: boolean;
        longValue?: number;
        stringValue?: string;
      }
    | undefined
) {
  if (!field || field.isNull) {
    return null;
  }

  if (field.stringValue !== undefined) {
    return field.stringValue;
  }

  if (field.longValue !== undefined) {
    return field.longValue;
  }

  if (field.doubleValue !== undefined) {
    return field.doubleValue;
  }

  if (field.booleanValue !== undefined) {
    return field.booleanValue;
  }

  if (field.blobValue !== undefined) {
    return Buffer.from(field.blobValue).toString("base64");
  }

  if (field.arrayValue !== undefined) {
    return field.arrayValue;
  }

  return null;
}

function mapRows(result: {
  columnMetadata?: Array<{ label?: string; name?: string }>;
  records?: Array<
    Array<{
      arrayValue?: unknown;
      blobValue?: Uint8Array;
      booleanValue?: boolean;
      doubleValue?: number;
      isNull?: boolean;
      longValue?: number;
      stringValue?: string;
    }>
  >;
}) {
  const columns = result.columnMetadata?.map((column) => column.label ?? column.name ?? "") ?? [];
  const rows =
    result.records?.map((record) =>
      Object.fromEntries(
        record.map((field, index) => [columns[index] || `column_${index + 1}`, getFieldValue(field)])
      )
    ) ?? [];

  return { columns, rows };
}

function getConnectionInfo(env: NodeJS.ProcessEnv): LambdaEnvResult {
  const lambdaEnv = getLambdaEnv(env);
  if (lambdaEnv.DB_DRIVER !== "aws-data-api-pg") {
    throw new Error(
      "This environment is not configured for Aurora Data API (DB_DRIVER=aws-data-api-pg). " +
        "Use direct Postgres connectivity instead."
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

  return { database, resourceArn, secretArn };
}

async function main() {
  const scriptDir = fileURLToPath(new URL(".", import.meta.url));
  const repoRoot = resolve(scriptDir, "../../..");

  dotenv.config();
  dotenv.config({ path: resolve(repoRoot, "infrastructure/cdk/.env.deploy"), override: false });

  const args = parseArgs(process.argv.slice(2));
  const env = { ...process.env };
  const awsRegion = env.AWS_REGION;
  if (!awsRegion) {
    throw new Error("AWS_REGION is required (set in environment or infrastructure/cdk/.env.deploy).");
  }

  const sql = getSqlText(repoRoot, args);
  const { database, resourceArn, secretArn } = getConnectionInfo(env);
  const client = new RDSDataClient({ region: awsRegion });

  await waitForAuroraResume({ client, database, resourceArn, secretArn });

  const result = await client.send(
    new ExecuteStatementCommand({
      database,
      includeResultMetadata: true,
      resourceArn,
      secretArn,
      sql,
    })
  );

  const mapped = mapRows(result);
  if (args.json) {
    console.info(
      JSON.stringify(
        {
          columns: mapped.columns,
          numberOfRecordsUpdated: result.numberOfRecordsUpdated ?? 0,
          rows: mapped.rows,
        },
        null,
        2
      )
    );
    return;
  }

  if (mapped.rows.length > 0) {
    console.table(mapped.rows);
  }

  if (result.numberOfRecordsUpdated !== undefined) {
    console.info(`Rows updated: ${result.numberOfRecordsUpdated}`);
  }
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
