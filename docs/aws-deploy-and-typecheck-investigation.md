# AWS Deploy and Typecheck Investigation

This note captures the current local measurements and the recommended next step for issue `#6`.

## Updated deploy recommendation

The repo now has a real code-only AWS app deploy path:

```bash
npm run deploy:aws:app
```

That command rebuilds the Nuxt AWS Lambda bundle and updates the existing Lambda function code directly with `aws lambda update-function-code`. It does not run `cdk deploy`, so it does not enter CloudFormation stack update planning and does not involve Aurora for routine app-code-only releases.

For changes that affect infrastructure or deploy-time environment values, use:

```bash
npm run deploy:aws:stack
```

For infrastructure or schema changes that also require applying committed SQL migrations, use:

```bash
npm run deploy:aws
```

## Current local measurements

Machine and repo state:
- Recorded on `2026-04-10`
- Repo root: `oceanmd-autorouter`
- Commands run from a warm local checkout with dependencies already installed
- First-run timings can be materially slower than repeated runs because Nuxt and TypeScript caches are not stable between cold and warm invocations.

Single-run wall-clock measurements captured locally:

| Command | Time |
| --- | ---: |
| `npm run typecheck` | `80.35s` |
| `npx vue-tsc -p tsconfig.json --noEmit` | `20.09s` |
| `npx tsc -p tsconfig.json --noEmit` | `12.21s` |
| `npm exec --package @typescript/native-preview -- tsgo -p tsconfig.json --noEmit` | `5.94s` |
| `npm run build` | `121.95s` |
| `npm run build:aws` | `121.20s` |
| `npm --prefix infrastructure/cdk run cdk:synth -- --no-lookups` | `13.29s` |

Takeaways from those measurements:
- The current explicit quality gate is `nuxi typecheck`, and it is materially slower than plain `tsc`, `vue-tsc`, or `tsgo`.
- Local `build` and `build:aws` are effectively the same cost in this repo. The AWS Nitro preset does not dominate the local build time by itself.
- Local `cdk synth` is much cheaper than the Nuxt build, which supports the issue observation that the longest deploy delays are likely happening after local packaging, during asset publish or CloudFormation/Aurora work.

## What is already in place

These quick wins from the issue are already implemented in the repo:
- `@nuxt/devtools` is development-only in `nuxt.config.ts`.
- Nuxt build-time type checking is disabled via `typescript.typeCheck = false`.
- The main README and AWS CDK README already document `deploy:aws:app` as the default path for routine app-only changes.

This issue adds one more small guardrail:
- `infrastructure/cdk/scripts/deploy-app-and-migrate.sh` now prints a warning that this path is for deploy-plus-migrate work, and points routine app-only changes at the faster app deploy wrapper.

## `tsgo` evaluation

Repository touchpoints today:
- The enforced repo command is `npm run typecheck`, which resolves to `npx nuxi typecheck`.
- The repo also has `vue-tsc` installed, but it is not the primary documented or enforced command.
- CDK uses classic `tsc -p tsconfig.json --noEmit` inside `infrastructure/cdk`.
- A CDK-only experimental script is now available as `npm --prefix infrastructure/cdk run build:tsgo`.

Primary source references:
- [TypeScript team: A 10x Faster TypeScript](https://devblogs.microsoft.com/typescript/typescript-native-port/)
- [TypeScript team: Announcing TypeScript Native Previews](https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/)
- [TypeScript team: Progress on TypeScript 7 - December 2025](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)

Measured CDK-only benchmark on the same machine, using warm runs:

| Command | Runs | Mean | Samples |
| --- | ---: | ---: | --- |
| `npm --prefix infrastructure/cdk run build` | `3` | `3.30s` | `3.19s`, `2.94s`, `3.76s` |
| `npm --prefix infrastructure/cdk run build:tsgo` | `3` | `2.10s` | `2.45s`, `1.92s`, `1.93s` |

Recommendation:
- Do not replace `npm run typecheck` with `tsgo` today.
- `tsgo` is promising as a fast standalone TypeScript checker, but the repo's real gate is Nuxt/Vue-aware and goes through `nuxi typecheck`, not raw `tsc`.
- The CDK benchmark shows `tsgo` is about `1.6x` faster than the existing CDK `tsc` check on warm runs. That is a real improvement, but not large enough by itself to justify widening the experiment beyond the CDK package.
- The app-level benchmark still shows the much larger gap is between raw TypeScript checks and `nuxi typecheck`, and that does not establish feature parity for `.vue`-aware checking, Nuxt-generated types, or Volar/Nuxt integration.
- The low-risk place to keep trialing it is the CDK package, where the command is already plain `tsc --noEmit`.

Conservative next step:
1. Keep `npm run typecheck` unchanged for app code.
2. Trial `npm --prefix infrastructure/cdk run build:tsgo` alongside the existing CDK `tsc` check before considering any replacement.
3. Revisit app-level adoption only if Nuxt/Vue tooling explicitly supports the native compiler path with equivalent diagnostics.

## Why Aurora may still participate in "app-only" deploys

The previous stack-based app deploy wrapper reduced work, but it did not isolate the database from CloudFormation:

- `infrastructure/cdk/scripts/deploy-app-with-env.sh` loads env, builds the Lambda bundle, and then runs `npm run cdk:deploy:app`.
- `infrastructure/cdk/package.json` defines `cdk:deploy:app` as `npm --prefix ../.. run build:aws && cdk deploy ${CDK_STACK_NAME:-dev}-autorouter`.
- `infrastructure/cdk/lib/stacks/autorouter-stack.ts` puts network, database, and app resources in one `AutorouterStack`.

That means the stack-based app deploy path skips post-deploy SQL migrations and now explicitly targets the single autorouter stack, but it still updates the same CloudFormation stack that owns Aurora. CloudFormation therefore reevaluates the whole stack on every such deploy.

The synthesized template also keeps the Lambda and IAM policy directly wired to Aurora outputs:

- Lambda env contains `DB_URL`, `DB_RESOURCE_ARN`, and `DB_SECRET_ARN` derived from the Aurora cluster and secret.
- The Lambda role policy references the Aurora cluster ARN and secret.
- Aurora serverless scaling is set explicitly on the `AWS::RDS::DBCluster` resource with `MinCapacity: 0`, `MaxCapacity: 2`, and `SecondsUntilAutoPause: 3600`.

Relevant AWS behavior:

- CloudFormation documents `ServerlessV2ScalingConfiguration` as an in-place-updatable `AWS::RDS::DBCluster` property.
  https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-rds-dbcluster.html
- Aurora documents that operations which modify cluster properties can resume paused Aurora Serverless v2 instances.
  https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html

Practical implication:

- A routine app deploy can still include Aurora in stack planning because the app and database are coupled in one stack.
- The existing code does not prove that Aurora should be modified on every app-only deploy. A real `AWS::RDS::DBCluster UPDATE_IN_PROGRESS` event during such a deploy suggests either:
  1. CloudFormation detected an actual DB cluster property change or drift, likely in Aurora cluster configuration, or
  2. a previous pending in-place Aurora modification was being applied during the next stack update.

## Safe-fix assessment

The safe code-level change is to avoid CloudFormation for pure app-code deploys.

- That is now implemented as the code-only deploy path described above.
- Splitting app and database into separate stacks is still the cleaner long-term infrastructure shape if stack-based app deploys remain common, but it is no longer required to remove Aurora from the routine code-only release path.
- The current code still does not justify removing or mutating Aurora cluster settings blindly. If stack-based deploys continue to show `AWS::RDS::DBCluster UPDATE_IN_PROGRESS`, the next step is still to capture live CloudFormation evidence before changing DB construct properties.

Recommended next validation step:

1. Run one real app-only deploy with CloudFormation event output enabled.
2. Capture whether the Aurora cluster enters update because of a concrete property change or merely as part of the stack update flow.
3. Compare the deployed stack template's Aurora properties with the locally synthesized template before making any DB construct changes.

If live AWS validation is required, run:

```bash
cd /Users/dougkavanagh/workspace/oceanmd-autorouter/infrastructure/cdk
AWS_PROFILE=ocean-autorouter AWS_REGION=ca-central-1 npm run cdk:deploy:app:env -- --profile "$AWS_PROFILE" --require-approval never --progress events 2>&1 | tee /tmp/autorouter-app-deploy.log
```

Then capture CloudFormation evidence:

```bash
aws cloudformation describe-stack-events \
  --stack-name "${CDK_STACK_NAME:-dev}-autorouter" \
  --query "StackEvents[?LogicalResourceId=='DatabaseAuroraCluster35AE33F7' || LogicalResourceId=='DatabaseAuroraClusterwriterE38F2C36'].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]" \
  --output table
```

And compare the deployed Aurora scaling properties with the synthesized template:

```bash
aws cloudformation get-template \
  --stack-name "${CDK_STACK_NAME:-dev}-autorouter" \
  --query "TemplateBody.Resources.DatabaseAuroraCluster35AE33F7.Properties.ServerlessV2ScalingConfiguration"
```

Evidence to keep:

- The `cdk deploy` event stream for the Aurora logical resources.
- The `ResourceStatusReason` for `DatabaseAuroraCluster35AE33F7`.
- The deployed stack template's `ServerlessV2ScalingConfiguration` versus the local synth output.

## How to collect more data

Two repeatable benchmark scripts are now available:

```bash
npm run benchmark:typecheck
npm run benchmark:build
```

Both accept repeated runs by invoking the underlying script directly:

```bash
node src/scripts/benchmark-pipeline.mjs --group typecheck --runs 3
node src/scripts/benchmark-pipeline.mjs --group build --runs 3
```

Those commands cover the local phases we can measure without a live AWS deploy. To finish the full issue investigation, collect at least three real AWS samples for:
- app-only deploys
- deploy-plus-migrate runs
- infra-changing deploys

and record the CloudFormation phase timings, especially any repeated `AWS::RDS::DBCluster UPDATE_IN_PROGRESS` events.
