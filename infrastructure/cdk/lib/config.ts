import { Construct } from "constructs";

export type DbEngine = "aurora-serverless-v2" | "rds-postgres";
export type NatGatewayStrategy = "Single" | "OnePerAz" | "None";

export type InfraConfig = {
  namePrefix: string;
  tags: Record<string, string>;

  vpcCidr: string;
  natGatewayStrategy: NatGatewayStrategy;

  publicUrl?: string;

  appMemorySize: number;
  appTimeoutSeconds: number;
  appLambdaBundlePath: string;
  appLambdaHandler: string;
  appEnv: Record<string, string>;
  appSecretEnv: Record<string, string>;

  dbEngine: DbEngine;
  dbUseDataApi: boolean;
  dbName: string;
  dbUsername: string;
  rdsInstanceClass: string;
  auroraMinAcu: number;
  auroraMaxAcu: number;
  dbDeletionProtection: boolean;
  dbSkipFinalSnapshot: boolean;
  dbFinalSnapshotIdentifierPrefix: string;
};

function parseJsonObject(value: string | undefined): Record<string, string> {
  if (!value) return {};

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }

  const asRecord = parsed as Record<string, unknown>;
  for (const [key, val] of Object.entries(asRecord)) {
    if (typeof val !== "string") {
      throw new Error(`Expected string value for key '${key}' in JSON object`);
    }
  }

  return asRecord as Record<string, string>;
}

function getString(scope: Construct, key: string): string | undefined {
  const contextVal = scope.node.tryGetContext(key);
  if (contextVal !== undefined && contextVal !== null && contextVal !== "") {
    return String(contextVal);
  }

  const envKey = key.toUpperCase();
  const snakeEnvKey = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
  const envVal = process.env[envKey] ?? process.env[snakeEnvKey];
  if (envVal !== undefined && envVal !== "") {
    return envVal;
  }

  return undefined;
}

function getNumber(scope: Construct, key: string): number | undefined {
  const raw = getString(scope, key);
  if (!raw) return undefined;

  const n = Number(raw);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid number for '${key}': ${raw}`);
  }

  return n;
}

function getBoolean(scope: Construct, key: string): boolean | undefined {
  const raw = getString(scope, key);
  if (raw === undefined) return undefined;

  if (raw === "true") return true;
  if (raw === "false") return false;

  throw new Error(`Invalid boolean for '${key}': ${raw} (use 'true' or 'false')`);
}

function getStackName(scope: Construct): string {
  return process.env.CDK_STACK_NAME ?? "dev";
}

export function getInfraConfig(scope: Construct): InfraConfig {
  const stackName = getStackName(scope);

  const namePrefix = getString(scope, "namePrefix") ?? "ocean-autorouter";

  const vpcCidr = getString(scope, "vpcCidr") ?? "10.0.0.0/16";
  const natGatewayStrategy =
    (getString(scope, "natGatewayStrategy") as NatGatewayStrategy | undefined) ??
    "Single";

  const publicUrl = getString(scope, "publicUrl");

  const appMemorySize = getNumber(scope, "appMemorySize") ?? 1024;
  const appTimeoutSeconds = getNumber(scope, "appTimeoutSeconds") ?? 30;
  const appLambdaBundlePath =
    getString(scope, "appLambdaBundlePath") ?? "../../.output";
  const appLambdaHandler =
    getString(scope, "appLambdaHandler") ?? "server/index.handler";
  const appEnv = parseJsonObject(getString(scope, "appEnv"));
  const appSecretEnv = parseJsonObject(getString(scope, "appSecretEnv"));

  const dbEngine =
    (getString(scope, "dbEngine") as DbEngine | undefined) ??
    "aurora-serverless-v2";
  const dbUseDataApi =
    getBoolean(scope, "dbUseDataApi") ?? dbEngine === "aurora-serverless-v2";
  const dbName = getString(scope, "dbName") ?? "autorouter";
  const dbUsername = getString(scope, "dbUsername") ?? "autorouter_admin";
  const rdsInstanceClass = getString(scope, "rdsInstanceClass") ?? "t4g.micro";
  const auroraMinAcu = getNumber(scope, "auroraMinAcu") ?? 0;
  const auroraMaxAcu = getNumber(scope, "auroraMaxAcu") ?? 2;

  const isProdStack = /\bprod(uction)?\b/i.test(stackName);
  const dbDeletionProtection = getBoolean(scope, "dbDeletionProtection") ?? isProdStack;
  const dbSkipFinalSnapshot = getBoolean(scope, "dbSkipFinalSnapshot") ?? !isProdStack;
  const dbFinalSnapshotIdentifierPrefix =
    getString(scope, "dbFinalSnapshotIdentifierPrefix") ?? `${namePrefix}-${stackName}`;

  const tags: Record<string, string> = {
    "ocean:app": "autorouter",
    "cdk:stack": stackName,
  };

  return {
    namePrefix,
    tags,
    vpcCidr,
    natGatewayStrategy,
    publicUrl,
    appMemorySize,
    appTimeoutSeconds,
    appLambdaBundlePath,
    appLambdaHandler,
    appEnv,
    appSecretEnv,
    dbEngine,
    dbUseDataApi: dbEngine === "aurora-serverless-v2" && dbUseDataApi,
    dbName,
    dbUsername,
    rdsInstanceClass,
    auroraMinAcu,
    auroraMaxAcu,
    dbDeletionProtection,
    dbSkipFinalSnapshot,
    dbFinalSnapshotIdentifierPrefix,
  };
}
