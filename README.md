# Ocean Autorouter

## Overview

Ocean Autorouter is an Ocean Labs innovation project that brings intelligent automation to Ocean eReferral and eConsult workflows.

Built as a standalone Nuxt application, it monitors referral events in real time, uses AI to analyze referral content (including form data, patient context, and attachments), and applies configurable rules to trigger secure routing actions in Ocean.

The result is faster intake operations, reduced administrative burden, and stronger support for scalable virtual care pathways.

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

## Database

The app supports two DB connection modes:

- `DB_DRIVER=pg` (default): direct PostgreSQL connection via `pg`; requires `DB_URL`.
  - Works with local Postgres and managed Postgres endpoints (for example AWS RDS PostgreSQL or Aurora PostgreSQL endpoint) when network access is available.
- `DB_DRIVER=aws-data-api-pg`: Aurora Data API mode; requires `DB_NAME`, `DB_RESOURCE_ARN`, `DB_SECRET_ARN`, and `AWS_REGION`.

Database schema lives in `drizzle/schema.ts`.

Push schema changes (development only):

```bash
npm run push
```

When `drizzle/schema.ts` changes, generate SQL migrations:

```bash
npm run db:migrate:generate
```

Note: `npm run push` uses `drizzle.config.ts` and currently requires `DB_URL` (direct SQL connection). For Aurora Data API environments, use the AWS migration flow documented in [infrastructure/cdk/README.md](infrastructure/cdk/README.md).

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
