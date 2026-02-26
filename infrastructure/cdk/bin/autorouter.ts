#!/usr/bin/env node
import { App } from "aws-cdk-lib";

import { AutorouterStack } from "../lib/stacks/autorouter-stack";

const app = new App();
const stackName = app.node.tryGetContext("stackName") ?? process.env.CDK_STACK_NAME ?? "dev";

new AutorouterStack(app, `${stackName}-autorouter`, {});
