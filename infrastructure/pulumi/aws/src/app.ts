import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

export type AppOutputs = {
  url: pulumi.Output<string>;
  appSecurityGroupId: pulumi.Output<string>;
};

export type LoadBalancerOutputs = {
  baseUrl: pulumi.Output<string>;
  albSecurityGroupId: pulumi.Output<string>;
  appSecurityGroupId: pulumi.Output<string>;
  targetGroupArn: pulumi.Output<string>;
};

export function createLoadBalancer(args: {
  name: string;
  tags: Record<string, string>;
  vpc: awsx.ec2.Vpc;
  albIngressCidrs: string[];
  containerPort: number;
  publicUrl?: string;
}): LoadBalancerOutputs {
  const albSg = new aws.ec2.SecurityGroup(`${args.name}-alb-sg`, {
    vpcId: args.vpc.vpcId,
    description: "ALB ingress",
    ingress: [
      {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        cidrBlocks: args.albIngressCidrs,
        description: "HTTP ingress",
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

  const appSg = new aws.ec2.SecurityGroup(`${args.name}-app-sg`, {
    vpcId: args.vpc.vpcId,
    description: "ECS tasks",
    ingress: [
      {
        protocol: "tcp",
        fromPort: args.containerPort,
        toPort: args.containerPort,
        securityGroups: [albSg.id],
        description: "From ALB",
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

  const alb = new aws.lb.LoadBalancer(`${args.name}-alb`, {
    loadBalancerType: "application",
    securityGroups: [albSg.id],
    subnets: args.vpc.publicSubnetIds,
    tags: args.tags,
  });

  const targetGroup = new aws.lb.TargetGroup(`${args.name}-tg`, {
    port: args.containerPort,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: args.vpc.vpcId,
    healthCheck: {
      path: "/",
      protocol: "HTTP",
      matcher: "200-399",
    },
    tags: args.tags,
  });

  new aws.lb.Listener(`${args.name}-http`, {
    loadBalancerArn: alb.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [
      {
        type: "forward",
        targetGroupArn: targetGroup.arn,
      },
    ],
    tags: args.tags,
  });

  const baseUrl = args.publicUrl
    ? pulumi.output(args.publicUrl)
    : pulumi.interpolate`http://${alb.dnsName}`;

  return {
    baseUrl,
    albSecurityGroupId: albSg.id,
    appSecurityGroupId: appSg.id,
    targetGroupArn: targetGroup.arn,
  };
}

export function createApp(args: {
  name: string;
  tags: Record<string, string>;
  vpc: awsx.ec2.Vpc;
  targetGroupArn: pulumi.Input<string>;
  appSecurityGroupId: pulumi.Input<string>;
  containerPort: number;
  cpu: number;
  memory: number;
  desiredCount: number;
  imageUri?: string;
  env: Record<string, pulumi.Input<string>>;
  secretEnv: pulumi.Output<Record<string, string>>;
  dbUrl: pulumi.Output<string>;
  baseUrl: pulumi.Output<string>;
}): AppOutputs {
  const cluster = new aws.ecs.Cluster(`${args.name}-cluster`, {
    tags: args.tags,
  });

  const taskAssumeRolePolicy = aws.iam.assumeRolePolicyForPrincipal({
    Service: "ecs-tasks.amazonaws.com",
  });

  const taskExecutionRole = new aws.iam.Role(`${args.name}-task-exec-role`, {
    assumeRolePolicy: taskAssumeRolePolicy,
    tags: args.tags,
  });

  new aws.iam.RolePolicyAttachment(`${args.name}-task-exec-managed`, {
    role: taskExecutionRole.name,
    policyArn: aws.iam.ManagedPolicy.AmazonECSTaskExecutionRolePolicy,
  });

  const taskRole = new aws.iam.Role(`${args.name}-task-role`, {
    assumeRolePolicy: taskAssumeRolePolicy,
    tags: args.tags,
  });

  const repo = new awsx.ecr.Repository(`${args.name}-repo`, {
    tags: args.tags,
  });

  const image =
    args.imageUri ??
    new awsx.ecr.Image(`${args.name}-image`, {
      repositoryUrl: repo.url,
      context: "../../..",
      platform: "linux/amd64",
    }).imageUri;

  const secret = new aws.secretsmanager.Secret(`${args.name}-app-secret`, {
    name: `${args.name}/app`,
    tags: args.tags,
  });

  const secretJson = pulumi
    .all([args.secretEnv, args.dbUrl])
    .apply(([secretEnv, dbUrl]) =>
      JSON.stringify({
        ...secretEnv,
        DB_URL: dbUrl,
      })
    );

  new aws.secretsmanager.SecretVersion(`${args.name}-app-secret-version`, {
    secretId: secret.id,
    secretString: secretJson,
  });

  const env: Record<string, pulumi.Input<string>> = {
    ...args.env,
    URL: args.baseUrl,
    DEPLOY_URL: args.baseUrl,
  };

  const secretKeys = args.secretEnv.apply((secretEnv) => Object.keys(secretEnv));

  const containerSecrets = pulumi
    .all([secret.arn, secretKeys])
    .apply(([secretArn, keys]) =>
      [
        ...keys.map((key) => ({
          name: key,
          valueFrom: `${secretArn}:${key}::`,
        })),
        { name: "DB_URL", valueFrom: `${secretArn}:DB_URL::` },
      ].sort((a, b) => a.name.localeCompare(b.name))
    );

  const logGroup = new aws.cloudwatch.LogGroup(`${args.name}-logs`, {
    retentionInDays: 14,
    tags: args.tags,
  });

  const service = new awsx.ecs.FargateService(`${args.name}-service`, {
    cluster: cluster.arn,
    desiredCount: args.desiredCount,
    networkConfiguration: {
      subnets: args.vpc.privateSubnetIds,
      securityGroups: [args.appSecurityGroupId],
      assignPublicIp: false,
    },
    loadBalancers: [
      {
        targetGroupArn: args.targetGroupArn,
        containerName: "autorouter",
        containerPort: args.containerPort,
      },
    ],
    taskDefinitionArgs: {
      executionRole: { roleArn: taskExecutionRole.arn },
      taskRole: { roleArn: taskRole.arn },
      container: {
        name: "autorouter",
        image,
        cpu: args.cpu,
        memory: args.memory,
        essential: true,
        portMappings: [{ containerPort: args.containerPort, protocol: "tcp" }],
        environment: Object.entries(env).map(([name, value]) => ({
          name,
          value,
        })),
        secrets: containerSecrets,
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logGroup.name,
            "awslogs-region": aws.config.region,
            "awslogs-stream-prefix": "ecs",
          },
        },
      },
    },
  });

  const secretsPolicy = new aws.iam.RolePolicy(`${args.name}-secrets-policy`, {
    role: taskExecutionRole.name,
    policy: pulumi
      .all([secret.arn])
      .apply(([secretArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["secretsmanager:GetSecretValue"],
              Resource: [secretArn],
            },
          ],
        })
      ),
  });

  // Ensure policy creation isn't optimized away by previews where roles exist but policy doesn't.
  void secretsPolicy;
  void service;

  return { url: args.baseUrl, appSecurityGroupId: pulumi.output(args.appSecurityGroupId) };
}
