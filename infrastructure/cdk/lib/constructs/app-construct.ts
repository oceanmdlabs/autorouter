import {
  Duration,
  RemovalPolicy,
  Stack,
  aws_ec2 as ec2,
  aws_cloudtrail as cloudtrail,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
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
  bedrockGuardrailIdentifier?: string;
  bedrockGuardrailVersion?: string;
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
          "service-role/AWSLambdaBasicExecutionRole",
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole",
        ),
      ],
    });

    if (
      props.dataApi?.enabled &&
      props.dataApi.resourceArn &&
      props.dataApi.secretArn
    ) {
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
        }),
      );

      role.addToPolicy(
        new iam.PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [props.dataApi.secretArn],
        }),
      );
    }

    const bedrockInvokeActions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ];
    const guardrailIdentifier = props.bedrockGuardrailIdentifier;
    const guardrailVersion = props.bedrockGuardrailVersion;

    if (guardrailIdentifier && guardrailVersion) {
      const guardrailArn = guardrailIdentifier.startsWith("arn:")
        ? guardrailIdentifier
        : `arn:${Stack.of(this).partition}:bedrock:ca-central-1:${Stack.of(this).account}:guardrail/${guardrailIdentifier}`;
      const versionedGuardrailArn = `${guardrailArn}:${guardrailVersion}`;
      const foundationModelsArn = `arn:${Stack.of(this).partition}:bedrock:ca-central-1::foundation-model/*`;

      role.addToPolicy(
        new iam.PolicyStatement({
          actions: bedrockInvokeActions,
          resources: [foundationModelsArn],
          conditions: {
            StringEquals: {
              "bedrock:GuardrailIdentifier": versionedGuardrailArn,
            },
          },
        }),
      );

      // Keep this explicit deny even if another policy later grants model access.
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: bedrockInvokeActions,
          resources: ["*"],
          conditions: {
            StringNotEquals: {
              "bedrock:GuardrailIdentifier": versionedGuardrailArn,
            },
          },
        }),
      );

      role.addToPolicy(
        new iam.PolicyStatement({
          actions: ["bedrock:ApplyGuardrail"],
          resources: [guardrailArn],
        }),
      );
    } else {
      // Bedrock is fail-closed until an approved, version-pinned guardrail is supplied.
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: bedrockInvokeActions,
          resources: ["*"],
        }),
      );
    }

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sms-voice:SendTextMessage"],
        resources: ["*"],
      }),
    );

    const erequestsBucket = new s3.Bucket(this, "ErequestsBucket", {
      bucketName: `${props.namePrefix}-erequests`,
      removalPolicy: RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    const auditTrail = new cloudtrail.Trail(this, "AuditTrail", {
      includeGlobalServiceEvents: false,
      isMultiRegionTrail: true,
      managementEvents: cloudtrail.ReadWriteType.NONE,
    });
    auditTrail.logAllS3DataEvents({
      includeManagementEvents: false,
      readWriteType: cloudtrail.ReadWriteType.ALL,
    });

    erequestsBucket.grantReadWrite(role);

    const baseEnv: Record<string, string> = {
      ...props.env,
      ...props.secretEnv,
      DB_URL: props.dbUrl,
      URL: props.publicUrl ?? "",
      DEPLOY_URL: props.publicUrl ?? "",
      EREQUEST_S3_BUCKET: erequestsBucket.bucketName,
      ...(guardrailIdentifier && guardrailVersion
        ? {
            BEDROCK_GUARDRAIL_IDENTIFIER: guardrailIdentifier,
            BEDROCK_GUARDRAIL_VERSION: guardrailVersion,
          }
        : {}),
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
      runtime: lambda.Runtime.NODEJS_22_X,
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
      fn,
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
