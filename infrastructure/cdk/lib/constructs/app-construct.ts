import {
  Duration,
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_apigatewayv2 as apigwv2,
  aws_apigatewayv2_integrations as apigwv2Integrations,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export type AppConstructProps = {
  namePrefix: string;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  dbUrl: string;
  dataApi?: {
    enabled: boolean;
    resourceArn?: string;
    secretArn?: string;
    database?: string;
  };
  env: Record<string, string>;
  secretEnv: Record<string, string>;
  publicUrl?: string;
  memorySize: number;
  timeoutSeconds: number;
  lambdaBundlePath: string;
  lambdaHandler: string;
};

export type AppConstructOutputs = {
  url: string;
  lambdaName: string;
};

export class AppConstruct extends Construct {
  readonly outputs: AppConstructOutputs;

  constructor(scope: Construct, id: string, props: AppConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, "LambdaRole", {
      roleName: `${props.namePrefix}-lambda-role`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
        ),
      ],
    });

    if (props.dataApi?.enabled && props.dataApi.resourceArn && props.dataApi.secretArn) {
      role.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            "rds-data:BatchExecuteStatement",
            "rds-data:BeginTransaction",
            "rds-data:CommitTransaction",
            "rds-data:ExecuteStatement",
            "rds-data:RollbackTransaction",
          ],
          resources: [props.dataApi.resourceArn],
        })
      );

      role.addToPolicy(
        new iam.PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [props.dataApi.secretArn],
        })
      );
    }

    const baseEnv: Record<string, string> = {
      ...props.env,
      ...props.secretEnv,
      DB_URL: props.dbUrl,
      URL: props.publicUrl ?? "",
      DEPLOY_URL: props.publicUrl ?? "",
    };

    if (
      props.dataApi?.enabled &&
      props.dataApi.resourceArn &&
      props.dataApi.secretArn &&
      props.dataApi.database
    ) {
      baseEnv.DB_DRIVER = "aws-data-api-pg";
      baseEnv.DB_RESOURCE_ARN = props.dataApi.resourceArn;
      baseEnv.DB_SECRET_ARN = props.dataApi.secretArn;
      baseEnv.DB_NAME = props.dataApi.database;
    }

    const fn = new lambda.Function(this, "AppLambda", {
      functionName: `${props.namePrefix}-lambda`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: props.lambdaHandler,
      role,
      memorySize: props.memorySize,
      timeout: Duration.seconds(props.timeoutSeconds),
      architecture: lambda.Architecture.X86_64,
      code: lambda.Code.fromAsset(props.lambdaBundlePath),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.appSecurityGroup],
      environment: baseEnv,
    });

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `${props.namePrefix}-http-api`,
    });

    const integration = new apigwv2Integrations.HttpLambdaIntegration(
      "DefaultIntegration",
      fn
    );

    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    });

    httpApi.addRoutes({
      path: "/",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    });

    const resolvedUrl = props.publicUrl ?? httpApi.apiEndpoint;
    this.outputs = {
      url: resolvedUrl,
      lambdaName: fn.functionName,
    };
  }
}
