import * as pulumi from "@pulumi/pulumi";

export type DbEngine = "aurora-serverless-v2" | "rds-postgres";
export type NatGatewayStrategy = "Single" | "OnePerAz";

export type InfraConfig = {
  namePrefix: string;
  tags: Record<string, string>;

  vpcCidr: string;
  natGatewayStrategy: NatGatewayStrategy;

  publicUrl?: string;

  app: {
    memorySize: number;
    timeoutSeconds: number;
    lambdaBundlePath: string;
    env: Record<string, string>;
    secretEnv: pulumi.Output<Record<string, string>>;
  };

  db: {
    engine: DbEngine;
    dbName: string;
    username: string;
    rdsInstanceClass: string;
    auroraMinAcu: number;
    auroraMaxAcu: number;
    deletionProtection: boolean;
    skipFinalSnapshot: boolean;
    finalSnapshotIdentifierPrefix: string;
  };
};

export function getInfraConfig(): InfraConfig {
  const pulumiConfig = new pulumi.Config();

  const namePrefix = pulumiConfig.get("namePrefix") ?? "ocean-autorouter";

  const vpcCidr = pulumiConfig.get("vpcCidr") ?? "10.0.0.0/16";
  const natGatewayStrategy =
    (pulumiConfig.get("natGatewayStrategy") as NatGatewayStrategy | undefined) ??
    "Single";

  const publicUrl = pulumiConfig.get("publicUrl") ?? undefined;

  const appEnv =
    pulumiConfig.getObject<Record<string, string>>("appEnv") ?? {};
  const appSecretEnv =
    (pulumiConfig.getSecretObject<Record<string, string>>("appSecretEnv") as
      | pulumi.Output<Record<string, string>>
      | undefined) ?? pulumi.secret({} as Record<string, string>);

  const appMemorySize = pulumiConfig.getNumber("appMemorySize") ?? 1024;
  const appTimeoutSeconds = pulumiConfig.getNumber("appTimeoutSeconds") ?? 30;
  const appLambdaBundlePath =
    pulumiConfig.get("appLambdaBundlePath") ?? "../../../.output/server";

  const dbEngine = (pulumiConfig.get("dbEngine") ??
    "aurora-serverless-v2") as DbEngine;
  const dbName = pulumiConfig.get("dbName") ?? "autorouter";
  const dbUsername = pulumiConfig.get("dbUsername") ?? "autorouter_admin";

  const rdsInstanceClass =
    pulumiConfig.get("rdsInstanceClass") ?? "db.t4g.micro";
  const auroraMinAcu = pulumiConfig.getNumber("auroraMinAcu") ?? 0;
  const auroraMaxAcu = pulumiConfig.getNumber("auroraMaxAcu") ?? 2;

  const stack = pulumi.getStack();
  const isProdStack = /\bprod(uction)?\b/i.test(stack);
  const dbDeletionProtection =
    pulumiConfig.getBoolean("dbDeletionProtection") ?? isProdStack;
  const dbSkipFinalSnapshot =
    pulumiConfig.getBoolean("dbSkipFinalSnapshot") ?? !isProdStack;
  const dbFinalSnapshotIdentifierPrefix =
    pulumiConfig.get("dbFinalSnapshotIdentifierPrefix") ?? `${namePrefix}-${stack}`;

  const tags: Record<string, string> = {
    "ocean:app": "autorouter",
    "pulumi:stack": stack,
  };

  return {
    namePrefix,
    tags,
    vpcCidr,
    natGatewayStrategy,
    publicUrl,
    app: {
      memorySize: appMemorySize,
      timeoutSeconds: appTimeoutSeconds,
      lambdaBundlePath: appLambdaBundlePath,
      env: appEnv,
      secretEnv: appSecretEnv,
    },
    db: {
      engine: dbEngine,
      dbName,
      username: dbUsername,
      rdsInstanceClass,
      auroraMinAcu,
      auroraMaxAcu,
      deletionProtection: dbDeletionProtection,
      skipFinalSnapshot: dbSkipFinalSnapshot,
      finalSnapshotIdentifierPrefix: dbFinalSnapshotIdentifierPrefix,
    },
  };
}
