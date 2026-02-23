import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

import type { DbEngine } from "./config";

export type DatabaseOutputs = {
  dbUrl: pulumi.Output<string>;
  dbSecurityGroupId: pulumi.Output<string>;
};

export function createDatabase(args: {
  name: string;
  tags: Record<string, string>;
  engine: DbEngine;
  vpcId: pulumi.Input<string>;
  privateSubnetIds: pulumi.Input<pulumi.Input<string>[]>;
  appSecurityGroupId: pulumi.Input<string>;
  dbName: string;
  username: string;
  rdsInstanceClass: string;
  auroraMinAcu: number;
  auroraMaxAcu: number;
  deletionProtection: boolean;
  skipFinalSnapshot: boolean;
  finalSnapshotIdentifierPrefix: string;
}): DatabaseOutputs {
  const dbSg = new aws.ec2.SecurityGroup(`${args.name}-db-sg`, {
    vpcId: args.vpcId,
    description: "Postgres access from app tasks",
    ingress: [
      {
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        securityGroups: [args.appSecurityGroupId],
        description: "Postgres from app SG",
      },
    ],
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
        description: "All egress",
      },
    ],
    tags: args.tags,
  });

  const subnetGroup = new aws.rds.SubnetGroup(`${args.name}-db-subnets`, {
    subnetIds: args.privateSubnetIds,
    tags: args.tags,
  });

  const password = new random.RandomPassword(`${args.name}-db-password`, {
    length: 24,
    special: true,
    overrideSpecial: "_%@",
  });
  const encodedPassword = password.result.apply(encodeURIComponent);
  const finalSnapshotId = `${args.finalSnapshotIdentifierPrefix}-final`;

  if (args.engine === "aurora-serverless-v2") {
    const cluster = new aws.rds.Cluster(`${args.name}-aurora`, {
      engine: "aurora-postgresql",
      databaseName: args.dbName,
      masterUsername: args.username,
      masterPassword: password.result,
      dbSubnetGroupName: subnetGroup.name,
      vpcSecurityGroupIds: [dbSg.id],
      storageEncrypted: true,
      skipFinalSnapshot: args.skipFinalSnapshot,
      finalSnapshotIdentifier: args.skipFinalSnapshot ? undefined : `${finalSnapshotId}-aurora`,
      deletionProtection: args.deletionProtection,
      serverlessv2ScalingConfiguration: {
        minCapacity: args.auroraMinAcu,
        maxCapacity: args.auroraMaxAcu,
      },
      tags: args.tags,
    });

    new aws.rds.ClusterInstance(`${args.name}-aurora-instance`, {
      clusterIdentifier: cluster.id,
      instanceClass: "db.serverless",
      engine: "aurora-postgresql",
      dbSubnetGroupName: subnetGroup.name,
      publiclyAccessible: false,
      tags: args.tags,
    });

    const dbUrl = pulumi.interpolate`postgresql://${args.username}:${encodedPassword}@${cluster.endpoint}:5432/${args.dbName}`;
    return { dbUrl, dbSecurityGroupId: dbSg.id };
  }

  const instance = new aws.rds.Instance(`${args.name}-rds`, {
    engine: "postgres",
    instanceClass: args.rdsInstanceClass,
    allocatedStorage: 20,
    maxAllocatedStorage: 100,
    dbName: args.dbName,
    username: args.username,
    password: password.result,
    dbSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: [dbSg.id],
    publiclyAccessible: false,
    storageEncrypted: true,
    skipFinalSnapshot: args.skipFinalSnapshot,
    finalSnapshotIdentifier: args.skipFinalSnapshot ? undefined : `${finalSnapshotId}-rds`,
    deletionProtection: args.deletionProtection,
    tags: args.tags,
  });

  const dbUrl = pulumi.interpolate`postgresql://${args.username}:${encodedPassword}@${instance.address}:5432/${args.dbName}`;
  return { dbUrl, dbSecurityGroupId: dbSg.id };
}
