# AWS Deploy and Typecheck Investigation

This note captures the current local measurements and the recommended next step for issue `#6`.

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

Recommendation:
- Do not replace `npm run typecheck` with `tsgo` today.
- `tsgo` is promising as a fast standalone TypeScript checker, but the repo's real gate is Nuxt/Vue-aware and goes through `nuxi typecheck`, not raw `tsc`.
- The local benchmark shows `tsgo` is about `2x` faster than plain `tsc` and much faster than `vue-tsc` and `nuxi typecheck`, but that does not establish feature parity for `.vue`-aware checking, Nuxt-generated types, or Volar/Nuxt integration.
- The low-risk place to trial it is the CDK package, where the command is already plain `tsc --noEmit`.

Conservative next step:
1. Keep `npm run typecheck` unchanged for app code.
2. Trial `npm --prefix infrastructure/cdk run build:tsgo` alongside the existing CDK `tsc` check before considering any replacement.
3. Revisit app-level adoption only if Nuxt/Vue tooling explicitly supports the native compiler path with equivalent diagnostics.

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
