import * as aws from "@pulumi/aws";

import { getInfraConfig } from "./src/config";
import { createVpc } from "./src/network";
import { createDatabase } from "./src/database";
import { createApp } from "./src/app";

const cfg = getInfraConfig();
const name = cfg.namePrefix;

const { vpc } = createVpc({
  name: `${name}-vpc`,
  cidrBlock: cfg.vpcCidr,
  natGatewayStrategy: cfg.natGatewayStrategy,
});

const appSg = new aws.ec2.SecurityGroup(`${name}-app-sg`, {
  vpcId: vpc.vpcId,
  description: "Lambda functions",
  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
      description: "All egress",
    },
  ],
  tags: cfg.tags,
});

const db = createDatabase({
  name,
  tags: cfg.tags,
  engine: cfg.db.engine,
  vpcId: vpc.vpcId,
  privateSubnetIds: vpc.privateSubnetIds,
  appSecurityGroupId: appSg.id,
  dbName: cfg.db.dbName,
  username: cfg.db.username,
  rdsInstanceClass: cfg.db.rdsInstanceClass,
  auroraMinAcu: cfg.db.auroraMinAcu,
  auroraMaxAcu: cfg.db.auroraMaxAcu,
  deletionProtection: cfg.db.deletionProtection,
  skipFinalSnapshot: cfg.db.skipFinalSnapshot,
  finalSnapshotIdentifierPrefix: cfg.db.finalSnapshotIdentifierPrefix,
});

const app = createApp({
  name,
  tags: cfg.tags,
  vpc,
  appSecurityGroupId: appSg.id,
  dbUrl: db.dbUrl,
  env: cfg.app.env,
  secretEnv: cfg.app.secretEnv,
  publicUrl: cfg.publicUrl,
  memorySize: cfg.app.memorySize,
  timeoutSeconds: cfg.app.timeoutSeconds,
  lambdaBundlePath: cfg.app.lambdaBundlePath,
});

export const url = app.url;
export const vpcId = vpc.vpcId;
export const dbSecurityGroupId = db.dbSecurityGroupId;
export const appSecurityGroupId = app.appSecurityGroupId;
export const lambdaName = app.lambdaName;
