# Pulumi (AWS) Infrastructure

This folder contains a Pulumi program for deploying the Ocean Autorouter to AWS.

It provisions:
- VPC (public + private subnets, NAT)
- ECS/Fargate service for the Nuxt SSR app behind an ALB
- PostgreSQL database (Aurora Serverless v2 **or** RDS Postgres)
- Secrets Manager secret for app secrets + `DB_URL`

## Prereqs

- Pulumi CLI installed (`pulumi version`)
- AWS credentials configured (e.g. `aws configure` or env vars)
- Docker installed (only needed if you let Pulumi build/push the app image)

## Quick start

```bash
cd infrastructure/pulumi/aws
npm install
pulumi stack init dev

# Choose DB type
pulumi config set dbEngine aurora-serverless-v2
# pulumi config set dbEngine rds-postgres

# Non-secret env vars (JSON)
pulumi config set appEnv '{"NUXT_OAUTH_GITHUB_CLIENT_ID":"...","NUXT_OAUTH_GOOGLE_CLIENT_ID":"..."}'

# Secret env vars (JSON, encrypted in Pulumi config)
pulumi config set --secret appSecretEnv '{"NUXT_OAUTH_GITHUB_CLIENT_SECRET":"...","NUXT_OAUTH_GOOGLE_CLIENT_SECRET":"..."}'

pulumi up
```

## Config reference

- `namePrefix` (default: `ocean-autorouter`)
- `vpcCidr` (default: `10.0.0.0/16`)
- `albIngressCidrs` (default: `["0.0.0.0/0"]`)
- `publicUrl` (optional; if unset, uses ALB DNS name)

App:
- `appCpu` (default: `256`)
- `appMemory` (default: `512`)
- `appDesiredCount` (default: `1`)
- `appContainerPort` (default: `3000`)
- `appImageUri` (optional; if unset, Pulumi builds/pushes using `../../..` context)
- `appEnv` (object; non-secret env vars)
- `appSecretEnv` (secret object; secret env vars, stored in Secrets Manager at deploy-time)

DB:
- `dbEngine`: `aurora-serverless-v2` (default) or `rds-postgres`
- `dbName` (default: `autorouter`)
- `dbUsername` (default: `autorouter_admin`)
- `rdsInstanceClass` (default: `db.t4g.micro`)
- `auroraMinAcu` (default: `0.5`)
- `auroraMaxAcu` (default: `2`)
