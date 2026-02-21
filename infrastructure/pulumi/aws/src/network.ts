import * as awsx from "@pulumi/awsx";

export function createVpc(args: { name: string; cidrBlock: string }) {
  const vpc = new awsx.ec2.Vpc(args.name, {
    cidrBlock: args.cidrBlock,
    numberOfAvailabilityZones: 2,
    natGateways: { strategy: "OnePerAz" },
    subnetSpecs: [
      { type: awsx.ec2.SubnetType.Public, name: "public" },
      { type: awsx.ec2.SubnetType.Private, name: "private" },
    ],
  });

  return { vpc };
}
