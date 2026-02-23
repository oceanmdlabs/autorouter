import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

export type AppOutputs = {
  url: pulumi.Output<string>;
  appSecurityGroupId: pulumi.Output<string>;
  lambdaName: pulumi.Output<string>;
};

export function createApp(args: {
  name: string;
  tags: Record<string, string>;
  vpc: awsx.ec2.Vpc;
  appSecurityGroupId: pulumi.Input<string>;
  dbUrl: pulumi.Output<string>;
  env: Record<string, pulumi.Input<string>>;
  secretEnv: pulumi.Output<Record<string, string>>;
  publicUrl?: string;
  memorySize?: number;
  timeoutSeconds?: number;
  lambdaBundlePath?: string;
}): AppOutputs {
  const role = new aws.iam.Role(`${args.name}-lambda-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "lambda.amazonaws.com",
    }),
    tags: args.tags,
  });

  new aws.iam.RolePolicyAttachment(`${args.name}-lambda-basic-exec`, {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  });

  new aws.iam.RolePolicyAttachment(`${args.name}-lambda-vpc-access`, {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaVPCAccessExecutionRole,
  });

  const httpApi = new aws.apigatewayv2.Api(`${args.name}-http-api`, {
    protocolType: "HTTP",
    tags: args.tags,
  });

  const baseUrl = args.publicUrl
    ? pulumi.output(args.publicUrl)
    : pulumi.output(httpApi.apiEndpoint);

  const env = pulumi
    .all([args.secretEnv, args.dbUrl, baseUrl])
    .apply(([secretEnv, dbUrl, resolvedBaseUrl]) => ({
      ...args.env,
      ...secretEnv,
      DB_URL: dbUrl,
      URL: resolvedBaseUrl,
      DEPLOY_URL: resolvedBaseUrl,
    }));

  const lambda = new aws.lambda.Function(`${args.name}-lambda`, {
    role: role.arn,
    runtime: "nodejs20.x",
    handler: "index.handler",
    memorySize: args.memorySize ?? 1024,
    timeout: args.timeoutSeconds ?? 30,
    architectures: ["x86_64"],
    code: new pulumi.asset.FileArchive(args.lambdaBundlePath ?? "../../../.output/server"),
    environment: {
      variables: env,
    },
    vpcConfig: {
      subnetIds: args.vpc.privateSubnetIds,
      securityGroupIds: [args.appSecurityGroupId],
    },
    tags: args.tags,
  });

  const integration = new aws.apigatewayv2.Integration(`${args.name}-lambda-integration`, {
    apiId: httpApi.id,
    integrationType: "AWS_PROXY",
    integrationUri: lambda.arn,
    payloadFormatVersion: "2.0",
  });

  new aws.apigatewayv2.Route(`${args.name}-default-route`, {
    apiId: httpApi.id,
    routeKey: "$default",
    target: pulumi.interpolate`integrations/${integration.id}`,
  });

  new aws.apigatewayv2.Stage(`${args.name}-default-stage`, {
    apiId: httpApi.id,
    name: "$default",
    autoDeploy: true,
    tags: args.tags,
  });

  new aws.lambda.Permission(`${args.name}-allow-api-gw`, {
    action: "lambda:InvokeFunction",
    function: lambda.arn,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${httpApi.executionArn}/*/*`,
  });

  return {
    url: baseUrl,
    appSecurityGroupId: pulumi.output(args.appSecurityGroupId),
    lambdaName: lambda.name,
  };
}
