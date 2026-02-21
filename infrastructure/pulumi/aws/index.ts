import { getInfraConfig } from "./src/config";
import { createVpc } from "./src/network";
import { createDatabase } from "./src/database";
import { createApp, createLoadBalancer } from "./src/app";

const cfg = getInfraConfig();
const name = cfg.namePrefix;

const { vpc } = createVpc({ name: `${name}-vpc`, cidrBlock: cfg.vpcCidr });

const lb = createLoadBalancer({
  name,
  tags: cfg.tags,
  vpc,
  albIngressCidrs: cfg.albIngressCidrs,
  containerPort: cfg.app.containerPort,
  publicUrl: cfg.publicUrl,
});

const db = createDatabase({
  name,
  tags: cfg.tags,
  engine: cfg.db.engine,
  vpcId: vpc.vpcId,
  privateSubnetIds: vpc.privateSubnetIds,
  appSecurityGroupId: lb.appSecurityGroupId,
  dbName: cfg.db.dbName,
  username: cfg.db.username,
  rdsInstanceClass: cfg.db.rdsInstanceClass,
  auroraMinAcu: cfg.db.auroraMinAcu,
  auroraMaxAcu: cfg.db.auroraMaxAcu,
});

const app = createApp({
  name,
  tags: cfg.tags,
  vpc,
  targetGroupArn: lb.targetGroupArn,
  appSecurityGroupId: lb.appSecurityGroupId,
  containerPort: cfg.app.containerPort,
  cpu: cfg.app.cpu,
  memory: cfg.app.memory,
  desiredCount: cfg.app.desiredCount,
  imageUri: cfg.app.imageUri,
  env: cfg.app.env,
  secretEnv: cfg.app.secretEnv,
  dbUrl: db.dbUrl,
  baseUrl: lb.baseUrl,
});

export const url = app.url;
export const vpcId = vpc.vpcId;
export const dbSecurityGroupId = db.dbSecurityGroupId;
