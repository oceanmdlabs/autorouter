# Ocean Autorouter

## Overview

Ocean Autorouter is an Ocean Labs innovation project that brings intelligent automation to Ocean eReferral and eConsult workflows.

Built as a standalone Nuxt application, it monitors referral events in real time, uses AI to analyze referral content (including form data, patient context, and attachments), and applies configurable rules to trigger secure routing actions in Ocean.

The result is faster intake operations, reduced administrative burden, and stronger support for scalable virtual care pathways.

Because the Autorouter may process clinical referral content with AI, review [docs/privacy-considerations.md](docs/privacy-considerations.md) before using it with real patient data. For production privacy review, use the reusable [Privacy Impact Assessment templates](docs/privacy-impact-assessment-templates.md).

## Tech Stack

- [Nuxt](https://nuxt.com/) + [Vue.js](https://vuejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)

## Architecture

The project follows Clean Architecture principles:

- `src/entities/` - core domain models and enterprise business rules
- `src/application/` - use cases and application orchestration
- `src/infrastructure/` - adapters, repositories, and external service integrations
- `server/` - Nuxt/Nitro server API routes and middleware
- `pages/`, `components/` - UI layer
- `drizzle/` - schema and SQL migrations
- `infrastructure/cdk/` - AWS CDK deployment infrastructure

## Prerequisites

- Node.js `>=20`
- npm
- PostgreSQL-compatible database

## Setup

Install dependencies:

```bash
npm install
```

Copy and configure environment variables:

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

## Development

Start the local dev server:

```bash
npm run dev
```

Run quality checks:

```bash
npm run typecheck
npm run test
```

## Current Boundaries

This repository is an intentionally practical reference implementation, not a complete clinical routing platform.

- Rules evaluate the referral event payload, the rule prompt, and any tool-specific inputs available at evaluation time. They do not natively query external EMRs, scheduling systems, or live Ocean operational data during rule evaluation.
- The Testing UI simulates rule evaluation and shows the actions that would be triggered, but it does not execute those actions against external systems.
- Rule collisions are still possible when multiple rules apply to the same event. Rules are evaluated and executed sequentially today, but there is no explicit rule priority model yet.
- Forwarding currently targets a single named listing per tool call. Ranked alternatives and criteria-based fallback routing are future enhancements rather than current behavior.
- SMS and email integrations are optional tenant-level features. A deployment can run without Twilio or SMTP2GO if those tools are not needed.

For a detailed review of PMIO demo feedback, current applicability, and open-source roadmap ideas, see [docs/pmio-demo-lessons-learned-review.md](docs/pmio-demo-lessons-learned-review.md).

## Database

The app supports two DB connection modes:

- `DB_DRIVER=pg` (default): direct PostgreSQL connection via `pg`; requires `DB_URL`.
  - Works with local Postgres and managed Postgres endpoints (for example AWS RDS PostgreSQL or Aurora PostgreSQL endpoint) when network access is available.
- `DB_DRIVER=aws-data-api-pg`: Aurora Data API mode; requires `DB_NAME`, `DB_RESOURCE_ARN`, `DB_SECRET_ARN`, and `AWS_REGION`.

Database schema lives in `drizzle/schema.ts`.

Apply committed migrations to a dedicated local database before generating new ones:

```bash
npm run db:migrate:apply:local
```

When `drizzle/schema.ts` changes, generate SQL migrations from that local database state:

```bash
npm run db:migrate:generate
```

Optional local-only escape hatch:

```bash
ALLOW_DRIZZLE_PUSH=1 npm run db:push:local
```

`db:migrate:generate` and `db:push:local` both refuse to run unless `DB_URL` points to a local Postgres instance whose applied migration hashes match the repo's committed migrations.

Read [DATABASE_MIGRATION_POLICY.md](DATABASE_MIGRATION_POLICY.md) before making SQL schema changes. For Aurora Data API environments, use the AWS migration flow documented in [infrastructure/cdk/README.md](infrastructure/cdk/README.md).

## Production

Build for production:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

## Deployment

Deployment and hosting guidance:

- [HOSTING.md](HOSTING.md) - hosting options, requirements, and provider-specific guidance
- [infrastructure/cdk/README.md](infrastructure/cdk/README.md) - AWS CDK deployment path

For routine AWS app-only code updates that do not change infrastructure or deployed environment variables, prefer:

```bash
npm run deploy:aws:app
```

That path rebuilds the Lambda bundle and updates the deployed Lambda code directly, without running CloudFormation.

If you changed infrastructure, deploy-time environment variables, or any DB-related CDK settings, use the stack deploy path instead:

```bash
npm run deploy:aws:stack
```

Use the full deploy+migrate path only when infrastructure or database changes require it and committed SQL migrations must also run:

```bash
npm run deploy:aws
```

To measure local typecheck and build phases before touching AWS:

```bash
npm run benchmark:typecheck
npm run benchmark:build
```

Current investigation notes live in [docs/aws-deploy-and-typecheck-investigation.md](docs/aws-deploy-and-typecheck-investigation.md).
