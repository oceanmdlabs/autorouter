import * as awsx from "@pulumi/awsx";

export function createVpc(args: {
  name: string;
  cidrBlock: string;
  natGatewayStrategy: "Single" | "OnePerAz";
}) {
  const vpc = new awsx.ec2.Vpc(args.name, {
    cidrBlock: args.cidrBlock,
    numberOfAvailabilityZones: 2,
    natGateways: { strategy: args.natGatewayStrategy },
    subnetSpecs: [
      { type: awsx.ec2.SubnetType.Public, name: "public" },
      { type: awsx.ec2.SubnetType.Private, name: "private" },
    ],
  });

  return { vpc };
}
