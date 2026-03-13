# SQL Schema Migration Policy

This policy exists to prevent schema drift between `drizzle/schema.ts`, committed SQL migrations, developer databases, and production.

## Source of truth

- `drizzle/schema.ts` defines the application schema.
- `drizzle/migrations/*.sql` and `drizzle/migrations/meta/*` are the only valid history of schema changes.
- The database is never the source of truth. If a database differs from committed migrations, the database is wrong until reconciled.

## Required workflow for schema changes

1. Sync your branch with `origin/main` before starting a schema change.
2. Point `DB_URL` at a dedicated local Postgres database on `localhost`, `127.0.0.1`, `::1`, or `host.docker.internal`.
3. Apply the repo's committed migrations to that database:

```bash
npm run db:migrate:apply:local
```

4. Make schema edits in `drizzle/schema.ts`.
5. Generate a new SQL migration:

```bash
npm run db:migrate:generate
```

6. Review the generated SQL manually. Confirm data preservation, lock behavior, defaults, indexes, enum changes, and rollback impact.
7. Run tests before opening a PR:

```bash
npm run test
```

8. Deploy schema changes by applying committed migrations only. For AWS Data API environments:

```bash
npm --prefix infrastructure/cdk run db:migrate:apply
```

## Forbidden actions

- Do not run `drizzle-kit push` or `npm run push` against shared, staging, or production databases.
- Do not generate migrations from a long-lived local database that may contain manual edits or branch-specific drift.
- Do not edit production schema manually unless the incident response explicitly requires it. If manual SQL is unavoidable, back-port the exact change into a committed migration immediately.
- Do not merge a schema PR that changes `drizzle/schema.ts` without the matching SQL migration and updated snapshot metadata.

## Repo safeguards

- `npm run db:migrate:generate` now refuses to run unless `DB_URL` points to a local database whose `drizzle.__drizzle_migrations` hashes exactly match the committed migrations in the branch.
- `npm run push` is now a guarded local-only escape hatch. It requires:
  - `DB_URL` to point to a local database
  - the local database migration history to match the repo
  - `ALLOW_DRIZZLE_PUSH=1`
- `npm run db:migrate:apply:local` applies committed migrations to the local database selected by `DB_URL`.

## PR requirements for schema changes

- Include the schema change in `drizzle/schema.ts`.
- Include the generated SQL migration and snapshot metadata.
- Describe any data backfill, one-time manual SQL, or operational sequencing in the PR description.
- If the migration is destructive or high risk, include a dry-run/verification plan and explicit production rollback approach.

## Production verification

Before applying migrations in a deployed AWS environment, verify the migration history:

```bash
npm run db:sql:aws -- --sql "select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc;" --json
```

If the hashes or row count do not match the repo's committed migrations, stop. Resolve drift first, then apply new migrations.
