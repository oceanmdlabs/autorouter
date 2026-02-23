# Pulumi (AWS) Infrastructure

This folder contains a Pulumi program for deploying the Ocean Autorouter to AWS.

It provisions:
- VPC (public + private subnets, NAT)
- Lambda + API Gateway HTTP API for the Nuxt SSR app
- PostgreSQL database (Aurora Serverless v2 **or** RDS Postgres)

## Prereqs

- Pulumi CLI installed (`pulumi version`)
- AWS credentials configured (e.g. `aws configure` or env vars)
- Build the Nuxt Lambda artifact before deploy:
  - `NITRO_PRESET=aws_lambda npm run build`

## Quick start

```bash
cd infrastructure/pulumi/aws
npm install
pulumi stack init dev

# Build Lambda artifact from repo root first
cd ../../..
NITRO_PRESET=aws_lambda npm run build
cd infrastructure/pulumi/aws

# Choose DB type
pulumi config set dbEngine aurora-serverless-v2
# pulumi config set dbEngine rds-postgres

# Non-secret env vars (JSON)
pulumi config set appEnv '{"NUXT_OAUTH_GITHUB_CLIENT_ID":"...","NUXT_OAUTH_GOOGLE_CLIENT_ID":"..."}'

# Secret env vars (JSON, encrypted in Pulumi config)
pulumi config set --secret appSecretEnv '{"NUXT_OAUTH_GITHUB_CLIENT_SECRET":"...","NUXT_OAUTH_GOOGLE_CLIENT_SECRET":"..."}'

pulumi up
```

## Deploy from local `.env`

If you have only been running locally so far, start with the same values you already use in your local `.env`.

1. Create a stack:
   - `pulumi stack init dev` (or `pulumi stack select dev`)
2. Build the Lambda bundle from repo root:
   - `NITRO_PRESET=aws_lambda npm run build`
3. Set baseline config:
   - `pulumi config set dbEngine aurora-serverless-v2`
   - `pulumi config set auroraMinAcu 0`
   - `pulumi config set natGatewayStrategy Single`
4. Populate Pulumi app env from your local `.env`:
   - Put non-sensitive values into `appEnv` JSON.
   - Put sensitive values into encrypted `appSecretEnv` JSON.
5. Preview and deploy:
   - `pulumi preview`
   - `pulumi up`

Example (replace values with your own):

```bash
pulumi config set appEnv '{
  "APP_NAME": "Ocean Autorouter",
  "HOST_URL": "https://your-domain.example",
  "SYSTEM_ADMIN_IDENTITY_PROVIDER": "https://issuer.example",
  "SYSTEM_ADMIN_USER_ID": "user-id-1,user-id-2",
  "OCEAN_SERVER": "production",
  "OCEAN_CLIENT_ID": "your-client-id"
}'

pulumi config set --secret appSecretEnv '{
  "NUXT_OAUTH_GITHUB_CLIENT_ID": "xxx",
  "NUXT_OAUTH_GITHUB_CLIENT_SECRET": "xxx",
  "NUXT_OAUTH_GOOGLE_CLIENT_ID": "xxx",
  "NUXT_OAUTH_GOOGLE_CLIENT_SECRET": "xxx",
  "OCEAN_CLIENT_SECRET": "xxx",
  "ENCRYPTION_KEY": "32+ chars",
  "JWT_SECRET": "strong-random-value"
}'
```

## Config reference

- `namePrefix` (default: `ocean-autorouter`)
- `vpcCidr` (default: `10.0.0.0/16`)
- `natGatewayStrategy` (default: `Single`; options: `Single`, `OnePerAz`)
- `publicUrl` (optional; if unset, uses API Gateway endpoint)

App:
- `appMemorySize` (default: `1024`)
- `appTimeoutSeconds` (default: `30`)
- `appLambdaBundlePath` (default: `../../../.output/server`)
- `appEnv` (object; non-secret env vars)
- `appSecretEnv` (secret object; secret env vars)

DB:
- `dbEngine`: `aurora-serverless-v2` (default) or `rds-postgres`
- `dbName` (default: `autorouter`)
- `dbUsername` (default: `autorouter_admin`)
- `rdsInstanceClass` (default: `db.t4g.micro`)
- `auroraMinAcu` (default: `0`)
- `auroraMaxAcu` (default: `2`)
- `dbDeletionProtection` (default: auto; `true` on stacks with `prod`/`production` in the stack name, otherwise `false`)
- `dbSkipFinalSnapshot` (default: auto; `false` on prod-like stacks, otherwise `true`)
- `dbFinalSnapshotIdentifierPrefix` (default: `<namePrefix>-<stack>`)

## Notes

- `auroraMinAcu=0` is for lowest idle cost and requires an Aurora Serverless v2-compatible engine version with auto-pause support in your region.
- Lambda is deployed inside the VPC private subnets to reach private RDS/Aurora.
- You can always override prod/dev DB safety defaults by explicitly setting `dbDeletionProtection` and `dbSkipFinalSnapshot`.
- Default DB safety behavior is stack-aware:
  - stack names containing `prod` or `production`: `dbDeletionProtection=true`, `dbSkipFinalSnapshot=false`
  - all other stack names: `dbDeletionProtection=false`, `dbSkipFinalSnapshot=true`
