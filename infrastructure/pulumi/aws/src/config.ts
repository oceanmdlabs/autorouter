import * as pulumi from "@pulumi/pulumi";

export type DbEngine = "aurora-serverless-v2" | "rds-postgres";

export type InfraConfig = {
  namePrefix: string;
  tags: Record<string, string>;

  vpcCidr: string;
  albIngressCidrs: string[];

  publicUrl?: string;

  app: {
    cpu: number;
    memory: number;
    desiredCount: number;
    containerPort: number;
    imageUri?: string;
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
  };
};

export function getInfraConfig(): InfraConfig {
  const pulumiConfig = new pulumi.Config();

  const namePrefix = pulumiConfig.get("namePrefix") ?? "ocean-autorouter";

  const vpcCidr = pulumiConfig.get("vpcCidr") ?? "10.0.0.0/16";
  const albIngressCidrs =
    pulumiConfig.getObject<string[]>("albIngressCidrs") ?? ["0.0.0.0/0"];

  const publicUrl = pulumiConfig.get("publicUrl") ?? undefined;

  const appEnv =
    pulumiConfig.getObject<Record<string, string>>("appEnv") ?? {};
  const appSecretEnv =
    (pulumiConfig.getSecretObject<Record<string, string>>("appSecretEnv") as
      | pulumi.Output<Record<string, string>>
      | undefined) ?? pulumi.secret({} as Record<string, string>);

  const appCpu = pulumiConfig.getNumber("appCpu") ?? 256;
  const appMemory = pulumiConfig.getNumber("appMemory") ?? 512;
  const appDesiredCount = pulumiConfig.getNumber("appDesiredCount") ?? 1;
  const appContainerPort = pulumiConfig.getNumber("appContainerPort") ?? 3000;
  const appImageUri = pulumiConfig.get("appImageUri") ?? undefined;

  const dbEngine = (pulumiConfig.get("dbEngine") ??
    "aurora-serverless-v2") as DbEngine;
  const dbName = pulumiConfig.get("dbName") ?? "autorouter";
  const dbUsername = pulumiConfig.get("dbUsername") ?? "autorouter_admin";

  const rdsInstanceClass =
    pulumiConfig.get("rdsInstanceClass") ?? "db.t4g.micro";
  const auroraMinAcu = pulumiConfig.getNumber("auroraMinAcu") ?? 0.5;
  const auroraMaxAcu = pulumiConfig.getNumber("auroraMaxAcu") ?? 2;

  const stack = pulumi.getStack();
  const tags: Record<string, string> = {
    "ocean:app": "autorouter",
    "pulumi:stack": stack,
  };

  return {
    namePrefix,
    tags,
    vpcCidr,
    albIngressCidrs,
    publicUrl,
    app: {
      cpu: appCpu,
      memory: appMemory,
      desiredCount: appDesiredCount,
      containerPort: appContainerPort,
      imageUri: appImageUri,
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
    },
  };
}
