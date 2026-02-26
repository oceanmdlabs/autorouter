# Ocean Autorouter

## Overview

Ocean Autorouter is a standalone Nuxt application that integrates with an Ocean site to automate eReferral and eConsult routing using AI and configurable rules.

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

Database schema lives in `drizzle/schema.ts`.

Push schema changes (development only):

```bash
npm run push
```

Generate SQL migrations:

```bash
npm run db:migrate:generate
```

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

