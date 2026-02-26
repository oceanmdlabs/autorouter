import { aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";

import { NatGatewayStrategy } from "../config";

export type NetworkConstructProps = {
  namePrefix: string;
  cidrBlock: string;
  natGatewayStrategy: NatGatewayStrategy;
};

export class NetworkConstruct extends Construct {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    const natGateways =
      props.natGatewayStrategy === "Single"
        ? 1
        : props.natGatewayStrategy === "OnePerAz"
          ? 2
          : 0;

    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: `${props.namePrefix}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(props.cidrBlock),
      maxAzs: 2,
      natGateways,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });
  }
}
