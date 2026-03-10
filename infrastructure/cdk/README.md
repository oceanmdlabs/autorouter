# Ocean Autorouter CDK Deployment (AWS)

This folder contains the AWS CDK infrastructure for deploying the Ocean Autorouter.

If you are new to this project, read these first:
- Project overview and app setup: [README.md](../../README.md)
- Hosting options and architecture context: [HOSTING.md](../../HOSTING.md)

This guide focuses on deploying to AWS with basic admin privileges.

## What this deploy creates

- VPC networking (public + private subnets)
- PostgreSQL database (Aurora Serverless v2 by default, or RDS PostgreSQL)
- Lambda function running the Nuxt server build
- API Gateway HTTP API in front of Lambda

## Folder structure

- `bin/autorouter.ts` - CDK entrypoint
- `lib/stacks/autorouter-stack.ts` - top-level stack composition
- `lib/constructs/network-construct.ts` - VPC/subnets/NAT
- `lib/constructs/database-construct.ts` - DB resources
- `lib/constructs/app-construct.ts` - Lambda/API resources
- `lib/config.ts` - config parsing from env/context

## Prerequisites

### AWS prerequisites

- Node.js 20+
- AWS CLI v2
- Access to target AWS account (SSO recommended)
- CDK bootstrap completed in target account/region

### Windows PowerShell quick equivalents

To avoid duplicating every command in this guide:
- Use `Copy-Item` instead of `cp` for file copies.
- Replace inline env assignment (for example `AWS_PROFILE=x AWS_REGION=y <command>`) with:
  `$env:AWS_PROFILE="x"; $env:AWS_REGION="y"; <command>`
- Replace `source file` with `. .\file`.

### App prerequisites (important)

The login page supports Google and GitHub OAuth. You should configure **at least one provider**.

- Google OAuth app (optional)
- GitHub OAuth app (optional)
- At least one fully configured provider is needed for a usable sign-in path

Setup guides:
- Google OAuth client app: [Create OAuth client credentials](https://support.google.com/cloud/answer/6158849)
- Google consent screen: [Configure OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent)
- GitHub OAuth app: [Creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

Use callback URLs based on your deployed app URL:
- Google redirect URI: `https://<your-domain>/auth/google`
- GitHub callback URL: `https://<your-domain>/auth/github`

Important:
- If you are not using a pre-registered custom domain, the API host/domain is usually only known after deployment.
- In that case, do an initial deploy, capture the deployed host, then update Google/GitHub OAuth callback URLs to `https://<host>/auth/google` and `https://<host>/auth/github`.
- Setting `PUBLIC_URL` helps keep callback URLs stable across deploys.

## Communication channels ownership

Email and SMS channels are configured by each tenant in their own Site Settings, not in this core autorouter infrastructure. This keeps communication channel ownership with each tenant.

## Required secrets and what they do

These are required for deployment:
- `NUXT_SESSION_PASSWORD`
- `ENCRYPTION_KEY`
- `JWT_SECRET`

### `NUXT_SESSION_PASSWORD`

Used by `nuxt-auth-utils` to seal/encrypt session cookies. In practice, it protects login session integrity/confidentiality.

- Required in production
- Recommended length: 32+ characters (longer is better)
- Rotating it will invalidate existing user sessions (users re-login)

### `ENCRYPTION_KEY`

Used by the app crypto service for:
- Encrypting/decrypting stored site secrets in DB (for example client secrets and API keys stored by the tenants to integrate withOcean and other services)

Important operational note:
- Rotating this key without a migration/re-encryption plan can make previously stored encrypted values unreadable.

### `JWT_SECRET`

Signs and verifies OAuth2 bearer tokens used by API clients.

Important operational note:
- Rotating this key invalidates existing JWT access tokens signed with the previous value.

### Generate safe values

Use one of these methods:

```bash
# 48 random bytes -> base64 string (good for both secrets)
openssl rand -base64 48
```

```bash
# Node.js alternative
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Avoid short, guessable, or reused secrets.

## 1) Configure and login with AWS SSO

```bash
aws configure sso --profile ocean-autorouter
aws sso login --profile ocean-autorouter
aws sts get-caller-identity --profile ocean-autorouter
```

## 2) Bootstrap CDK (first time per account/region)

```bash
cd infrastructure/cdk
AWS_PROFILE=ocean-autorouter AWS_REGION=ca-central-1 npx cdk bootstrap aws://145689193777/ca-central-1 --profile ocean-autorouter
```

## 3) Create deployment environment file

```bash
cd infrastructure/cdk
cp .env.deploy.example .env.deploy
```

Fill in `.env.deploy`:
- AWS target (`AWS_PROFILE`, `AWS_REGION`, optional `CDK_STACK_NAME`)
- At least one OAuth provider pair (`*_CLIENT_ID` + `*_CLIENT_SECRET`)
- `NUXT_SESSION_PASSWORD`
- `ENCRYPTION_KEY`
- `JWT_SECRET`
- Optional `PUBLIC_URL` (recommended for stable OAuth callback URLs)
  
## 4) Build + deploy

From `infrastructure/cdk`:

```bash
npm run cdk:deploy:app:env -- --profile "$AWS_PROFILE" --require-approval never
```

This wrapper command:
- Loads `.env.deploy`
- Builds the Nuxt Lambda bundle (`NITRO_PRESET=aws_lambda`)
- Injects app env/secrets into CDK config
- Runs `cdk deploy`

Build + deploy + apply SQL migrations:

```bash
npm run cdk:deploy:app:env:migrate -- --profile "$AWS_PROFILE" --require-approval never
```

## Keep deploy secrets in `.env.deploy` (simplest path)

For simplicity, you can keep all deploy values directly in `infrastructure/cdk/.env.deploy` and run deploy commands with that file loaded by the wrapper scripts.

For added security, you can keep deploy secrets in AWS Secrets Manager.
This quickstart focuses on the `.env.deploy` path.

## Database migrations

Apply migrations to deployed AWS environment:

```bash
npm --prefix infrastructure/cdk run db:migrate:apply
```

Run ad hoc SQL against the deployed AWS environment:

```bash
npm run db:sql:aws -- --sql "select now();"
```

```bash
npm run db:sql:aws -- --sql "select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc;" --json
```

```bash
npm run db:sql:aws -- --file infrastructure/cdk/scripts/query.sql
```

Notes:
- `db:migrate:apply` currently requires Aurora Data API (`dbUseDataApi=true`).
- If using private RDS Postgres without Data API, run migrations from inside VPC (for example a migration Lambda/CodeBuild job in VPC).
- Migration generation for schema changes is documented in the root [`README.md`](../../README.md).

## Optional post-deployment: grant app-level system admin

System admin is resolved at OAuth login time and stored in the session (`roles.admin = "system"`). It is not looked up on every request.

Allowlist table: `system_admin_allowlist`
- `provider`: `google` or `github`
- `subject`: OAuth identity subject
  - Google: `sub`
  - GitHub: numeric `user.id` as text
- `active`: set to `true`

Run this from repo root (set `ADMIN_PROVIDER` and `ADMIN_SUBJECT` first):

```bash
set -a; source infrastructure/cdk/.env.deploy; set +a

ADMIN_PROVIDER="google" # or github
ADMIN_SUBJECT="YOUR_PROVIDER_SUBJECT"

LAMBDA_NAME=$(aws cloudformation describe-stacks \
  --stack-name "${CDK_STACK_NAME:-dev}-autorouter" \
  --query 'Stacks[0].Outputs[?OutputKey==`lambdaName`].OutputValue' \
  --output text)

DB_RESOURCE_ARN=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --query 'Environment.Variables.DB_RESOURCE_ARN' \
  --output text)
DB_SECRET_ARN=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --query 'Environment.Variables.DB_SECRET_ARN' \
  --output text)
DB_NAME=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --query 'Environment.Variables.DB_NAME' \
  --output text)

aws rds-data execute-statement \
  --resource-arn "$DB_RESOURCE_ARN" \
  --secret-arn "$DB_SECRET_ARN" \
  --database "$DB_NAME" \
  --sql "insert into system_admin_allowlist (provider, subject, notes, active) values ('$ADMIN_PROVIDER', '$ADMIN_SUBJECT', 'system admin', true);"
```

- Insert that value into `system_admin_allowlist` (`provider`, `subject`, `active=true`).
- Log out and log back in (admin role is determined at login time).

Quick verification SQL:

```sql
select provider, subject, active, notes
from system_admin_allowlist
where provider='<provider>' and subject='<subject>';
```

Current privileged operations guarded by this role include:
- cross-tenant session switching (`POST /api/auth/update-tenant`)
- listing all site configurations (`GET /api/site-configuration/all`)

## System admin troubleshooting

If you are logged in but `roles.admin` is still `tenant` after adding an allowlist row:

- Confirm you are using the deployed stack URL output from CDK (not another environment).
- Sign in, then open `/api/_auth/session` and copy:
  - GitHub: `user.gitHubId`
  - Google: `user.googleId`
- Insert that value into `system_admin_allowlist` with the matching `provider` (`github` or `google`), `subject`, and `active=true`.
- Log out and log back in (admin role is determined at login time).

Quick verification SQL:

```sql
select provider, subject, active, notes
from system_admin_allowlist
where provider='<provider>' and subject='<subject>';
```

## Configuration tuning (for non-experts)

`lib/config.ts` supports many options. You usually only need to tune a few of these, if any.

### Most useful knobs

- `appMemorySize` (default `1024` MB)
  - Increase if requests are slow under load or Lambda memory alarms appear.
  - More memory usually means faster CPU but higher cost.

- `appTimeoutSeconds` (default `30`)
  - Increase if long-running API calls time out.
  - Keep as low as practical to prevent runaway requests.

- `dbEngine` (`aurora-serverless-v2` default, or `rds-postgres`)
  - Aurora Serverless v2: easier burst scaling, can pair with Data API.
  - RDS Postgres: simpler model/cost for very steady low traffic.

- `auroraMinAcu` / `auroraMaxAcu` (defaults `0` / `2`)
  - Increase max for peak traffic headroom.
  - Increase min if cold starts or scale-up latency are a concern.

- `natGatewayStrategy` (`Single` default)
  - `Single`: balanced cost/redundancy for most teams.
  - `OnePerAz`: better AZ resilience, higher cost.
  - `None`: lowest cost, but private subnets lose egress to internet.

- `dbDeletionProtection` and `dbSkipFinalSnapshot`
  - Safety settings for accidental deletions.
  - For production, keep deletion protection on and keep final snapshots.

### Practical starting profiles

- Dev/test cost-first:
  - `dbEngine=aurora-serverless-v2`, low ACU limits, `natGatewayStrategy=Single`
- Staging reliability checks:
  - mirror production engine and closer memory/timeout settings
- Production safety-first:
  - enable DB deletion protection, keep final snapshot, review NAT strategy and ACU limits for peak load

For full key list, see [`lib/config.ts`](./lib/config.ts).

## Useful commands

```bash
cd infrastructure/cdk
npm run build
npm run cdk:synth
npm run cdk:diff -- --profile ocean-autorouter
npm run cdk:deploy -- --profile ocean-autorouter --require-approval never
npm run cdk:destroy -- --profile ocean-autorouter --force
```

## Common deployment issues

1. `No AWS accounts are available to you`

Your IAM Identity Center user is authenticated but not assigned to an account/permission set. Ask an admin to assign the user in the correct Identity Center instance.

2. `The config profile (...) could not be found`

`aws configure sso` did not write a profile (often because no account assignment exists). Re-run `aws configure sso --profile ...` after assignment is fixed.

3. `SSM parameter /cdk-bootstrap/hnb659fds/version not found`

Target account/region has not been bootstrapped. Run `cdk bootstrap` for that account/region.

4. `--require-approval is enabled ... terminal (TTY) is not attached`

Use `--require-approval never` in non-interactive shells.

5. `Cannot find version ... for aurora-postgresql`

Pinned engine version is not available in the target region. Update `lib/constructs/database-construct.ts` to a supported Aurora PostgreSQL version for that region.

6. OAuth callback URL mismatch (`redirect_uri_mismatch`, callback URL not allowed, etc.)

OAuth providers must exactly match the deployed host callback paths:
- `https://<host>/auth/google`
- `https://<host>/auth/github`

If no custom domain is provisioned yet, the host is often unknown until the first deploy. Deploy once, capture the host, then update provider callback URLs and redeploy if needed.
