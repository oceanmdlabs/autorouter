import {
  RemovalPolicy,
  aws_ec2 as ec2,
  aws_rds as rds,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { DbEngine } from "../config";

export type DatabaseConstructProps = {
  namePrefix: string;
  engine: DbEngine;
  useDataApi: boolean;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  dbName: string;
  username: string;
  rdsInstanceClass: string;
  auroraMinAcu: number;
  auroraMaxAcu: number;
  deletionProtection: boolean;
  skipFinalSnapshot: boolean;
  finalSnapshotIdentifierPrefix: string;
};

export type DatabaseConstructOutputs = {
  dbSecurityGroup: ec2.SecurityGroup;
  dbUrl: string;
  dataApi: {
    enabled: boolean;
    resourceArn?: string;
    secretArn?: string;
    database?: string;
  };
};

export class DatabaseConstruct extends Construct {
  readonly outputs: DatabaseConstructOutputs;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc: props.vpc,
      description: "Postgres access from app functions",
      allowAllOutbound: true,
      securityGroupName: `${props.namePrefix}-db-sg`,
    });

    dbSecurityGroup.addIngressRule(
      props.appSecurityGroup,
      ec2.Port.tcp(5432),
      "Postgres from app security group"
    );

    if (props.engine === "aurora-serverless-v2") {
      const cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
        clusterIdentifier: `${props.namePrefix}-aurora`,
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_16_10,
        }),
        credentials: rds.Credentials.fromGeneratedSecret(props.username, {
          // Keep DB_URL token-safe without runtime URI encoding.
          excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
        }),
        defaultDatabaseName: props.dbName,
        writer: rds.ClusterInstance.serverlessV2("writer"),
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [dbSecurityGroup],
        serverlessV2MinCapacity: props.auroraMinAcu,
        serverlessV2MaxCapacity: props.auroraMaxAcu,
        deletionProtection: props.deletionProtection,
        removalPolicy: props.skipFinalSnapshot
          ? RemovalPolicy.DESTROY
          : RemovalPolicy.SNAPSHOT,
        enableDataApi: props.useDataApi,
      });

      const password = cluster.secret?.secretValueFromJson("password").unsafeUnwrap() ?? "";
      const dbUrl = `postgresql://${props.username}:${password}@${cluster.clusterEndpoint.hostname}:5432/${props.dbName}`;

      this.outputs = {
        dbSecurityGroup,
        dbUrl,
        dataApi: {
          enabled: props.useDataApi,
          resourceArn: props.useDataApi ? cluster.clusterArn : undefined,
          secretArn: props.useDataApi ? cluster.secret?.secretArn : undefined,
          database: props.useDataApi ? props.dbName : undefined,
        },
      };

      return;
    }

    const instance = new rds.DatabaseInstance(this, "RdsInstance", {
      instanceIdentifier: `${props.namePrefix}-rds`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3,
      }),
      credentials: rds.Credentials.fromGeneratedSecret(props.username, {
        // Keep DB_URL token-safe without runtime URI encoding.
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
      }),
      databaseName: props.dbName,
      instanceType: new ec2.InstanceType(props.rdsInstanceClass),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      publiclyAccessible: false,
      deletionProtection: props.deletionProtection,
      removalPolicy: props.skipFinalSnapshot
        ? RemovalPolicy.DESTROY
        : RemovalPolicy.SNAPSHOT,
      deleteAutomatedBackups: props.skipFinalSnapshot,
    });

    const password = instance.secret?.secretValueFromJson("password").unsafeUnwrap() ?? "";
    const dbUrl = `postgresql://${props.username}:${password}@${instance.instanceEndpoint.hostname}:5432/${props.dbName}`;

    this.outputs = {
      dbSecurityGroup,
      dbUrl,
      dataApi: {
        enabled: false,
      },
    };
  }
}
