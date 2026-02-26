import {
  CfnOutput,
  Stack,
  StackProps,
  Tags,
  aws_ec2 as ec2,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { getInfraConfig } from "../config";
import { AppConstruct } from "../constructs/app-construct";
import { DatabaseConstruct } from "../constructs/database-construct";
import { NetworkConstruct } from "../constructs/network-construct";

export class AutorouterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cfg = getInfraConfig(this);

    for (const [key, value] of Object.entries(cfg.tags)) {
      Tags.of(this).add(key, value);
    }

    const network = new NetworkConstruct(this, "Network", {
      namePrefix: cfg.namePrefix,
      cidrBlock: cfg.vpcCidr,
      natGatewayStrategy: cfg.natGatewayStrategy,
    });

    const appSecurityGroup = new ec2.SecurityGroup(this, "AppSecurityGroup", {
      vpc: network.vpc,
      description: "Lambda functions",
      allowAllOutbound: true,
      securityGroupName: `${cfg.namePrefix}-app-sg`,
    });

    const database = new DatabaseConstruct(this, "Database", {
      namePrefix: cfg.namePrefix,
      engine: cfg.dbEngine,
      useDataApi: cfg.dbUseDataApi,
      vpc: network.vpc,
      appSecurityGroup,
      dbName: cfg.dbName,
      username: cfg.dbUsername,
      rdsInstanceClass: cfg.rdsInstanceClass,
      auroraMinAcu: cfg.auroraMinAcu,
      auroraMaxAcu: cfg.auroraMaxAcu,
      deletionProtection: cfg.dbDeletionProtection,
      skipFinalSnapshot: cfg.dbSkipFinalSnapshot,
      finalSnapshotIdentifierPrefix: cfg.dbFinalSnapshotIdentifierPrefix,
    });

    if (cfg.natGatewayStrategy === "None" && cfg.dbUseDataApi) {
      new ec2.InterfaceVpcEndpoint(this, "RdsDataVpcEndpoint", {
        vpc: network.vpc,
        service: ec2.InterfaceVpcEndpointAwsService.RDS_DATA,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [appSecurityGroup],
      });
    }

    const app = new AppConstruct(this, "App", {
      namePrefix: cfg.namePrefix,
      vpc: network.vpc,
      appSecurityGroup,
      dbUrl: database.outputs.dbUrl,
      dataApi: database.outputs.dataApi,
      env: cfg.appEnv,
      secretEnv: cfg.appSecretEnv,
      publicUrl: cfg.publicUrl,
      memorySize: cfg.appMemorySize,
      timeoutSeconds: cfg.appTimeoutSeconds,
      lambdaBundlePath: cfg.appLambdaBundlePath,
      lambdaHandler: cfg.appLambdaHandler,
    });

    new CfnOutput(this, "url", { value: app.outputs.url });
    new CfnOutput(this, "vpcId", { value: network.vpc.vpcId });
    new CfnOutput(this, "dbSecurityGroupId", {
      value: database.outputs.dbSecurityGroup.securityGroupId,
    });
    new CfnOutput(this, "appSecurityGroupId", {
      value: appSecurityGroup.securityGroupId,
    });
    new CfnOutput(this, "lambdaName", { value: app.outputs.lambdaName });
  }
}
