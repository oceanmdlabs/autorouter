# Guide for AI Coding Agents (Claude Code, Copilot, etc.)

This file provides context for AI coding assistants working on this codebase.

## Project Context

This is the **Ocean Autorouter** - a Nuxt/Vue.js application that uses AI to intelligently route eReferrals and eConsults in the Ocean platform.

**Architecture**: Clean Architecture pattern with separation between business logic (entities/use cases) and infrastructure layer.

### Key Points for Agents

2. **Before Creating PRs**:

   ```bash
   # Always check local branch is synced with origin/main
   git fetch origin
   git log --oneline HEAD..origin/main
   ```

   If commits are listed, pull/rebase before creating a PR.

3. **Commit Workflow**:
   - Do not create a feature branch automatically. Stay on the current branch unless the user explicitly asks you to create or switch branches.
   - If the user explicitly asks for a feature branch, create it from `origin/main`
   - Before finishing a task, run `git status --short` and group your changes into logical commits instead of one catch-all commit
   - Stage only the files for the logical unit you are committing, write a specific message, and repeat until the task's intended changes are committed
   - Do not leave task-related tracked files uncommitted when you are done unless the user explicitly asks for a partial handoff
   - If you are working on a feature branch, push it to `origin` and create PRs targeting `main` in GitHub

4. **After Merge Conflicts During Rebase**:
   - Read the conflict markers carefully
   - Prefer the cleaner/simpler version if both are functionally identical
   - Let Prettier handle formatting in subsequent commits
   - Never skip or abort rebases without user approval

## Architecture Guidelines

**Clean Architecture Pattern**: Business logic is separated from infrastructure.

Key directories:

- `src/entities/` - Business entities and models
- `src/application/` - Use cases and business logic
- `src/infrastructure/` - External services, databases, APIs
- `server/` - Nuxt server API routes
- `pages/` - Vue page components
- `components/` - Reusable Vue components

**When making changes**:

- Keep business logic in `application/` layer
- Keep framework/library code in `infrastructure/` layer
- Use dependency injection via ApplicationContext
- Follow existing repository patterns

## AI and PHI Policy

Before designing or changing any workflow that may send personal health information (PHI) to an AI service, read and follow [`docs/privacy/ai-phi-policy.md`](docs/privacy/ai-phi-policy.md). The current CDS design and provider findings are in [`docs/privacy/cds-hooks-ai-phi-plan.md`](docs/privacy/cds-hooks-ai-phi-plan.md), [`docs/privacy/providers/google-gemini-phipa-review.md`](docs/privacy/providers/google-gemini-phipa-review.md), and [`docs/privacy/providers/aws-bedrock-phipa-review.md`](docs/privacy/providers/aws-bedrock-phipa-review.md).

Required agent behavior:

- Treat production PHI processing as disabled until the applicable contract, provider/model, residency, retention, PIA, TRA, clinical-safety, implementation, and approval gates have recorded evidence.
- Do not add or enable a provider, model, fallback, grounding, logging, cache, memory, RAG, agent, batch, evaluation, or attachment pathway for PHI unless its provider review and deployment approval explicitly allow it.
- Never log prompts, completions, clinical referral text, form answers, or attachments. Minimize model inputs and keep audit records content-free.
- Keep structured facts and enforceable rules deterministic. LLM-derived clinical or routing output is advisory unless clinical governance explicitly approves otherwise.
- Pin approved provider/model versions and Canadian endpoints, fail closed on configuration drift, and treat provider/model/region/retention changes as new review triggers.
- Update the dated provider review and supporting evidence before relying on changed terms, models, regions, retention behaviour, or subprocessors.

## Code Style

- **TypeScript**: Strict mode enabled
- **Components**: ShadCn Vue components (see [ui.shadcn.com](https://ui.shadcn.com))
- **Formatting**: Prettier (runs automatically)
- **Linting**: ESLint configured
- **Database**: Drizzle ORM with PostgreSQL

## Testing

Run tests before committing:

```bash
npm run test
```

## Debugging

Use the "Nuxt: Server" debug target in VS Code/Cursor (see `.vscode/launch.json`).

## Database Changes

Schema is in `drizzle/schema.ts`. Follow [`DATABASE_MIGRATION_POLICY.md`](DATABASE_MIGRATION_POLICY.md) for every SQL schema change.

Required agent behavior:

- Treat `drizzle/schema.ts` plus committed files in `drizzle/migrations/` as the only schema source of truth.
- Never run `drizzle-kit push` or `npm run push` against shared, staging, or production databases.
- Before generating a migration, point `DB_URL` at a dedicated local Postgres instance and run:
  ```bash
  npm run db:migrate:apply:local
  npm run db:migrate:generate
  ```
- Do not generate migrations from a local database that is out of sync with the repo. The guarded scripts will refuse this.
- Schema PRs must include `drizzle/schema.ts`, the generated SQL migration, snapshot metadata, and notes for any backfill/manual SQL.
- If production drift is suspected, verify `drizzle.__drizzle_migrations` in the deployed environment before applying anything new.

## Key Files to Reference

- [README.md](README.md) - Project overview and setup
- [HOSTING.md](HOSTING.md) - Deployment information
- [DATABASE_MIGRATION_POLICY.md](DATABASE_MIGRATION_POLICY.md) - Required SQL schema change workflow
- `drizzle/schema.ts` - Database schema
- `src/entities/models/` - Business models
