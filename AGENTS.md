# Guide for AI Coding Agents (Claude Code, Copilot, etc.)

This file provides context for AI coding assistants working on this codebase.

## Project Context

This is the **Ocean Autorouter** - a Nuxt/Vue.js application that uses AI to intelligently route eReferrals and eConsults in the Ocean platform.

**Architecture**: Clean Architecture pattern with separation between business logic (entities/use cases) and infrastructure layer.

## Development Workflow

**IMPORTANT**: This project uses a dual-repository workflow with cross-repo pull requests.

Before making commits or creating PRs, read [OCEANMD_WORKFLOW.md](OCEANMD_WORKFLOW.md) for complete details on:
- How the internal (`origin`) and open source (`opensource`) repos work together
- How to check if branches are in sync before creating PRs
- How to handle "branch behind" issues
- Branch cleanup after merges

### Key Points for Agents

1. **Repository Structure**:
   - `origin`: Internal repo (oceanmd/service-request-autorouter)
   - `opensource`: Open source repo (oceanmd_oss/service-request-autorouter)
   - All PRs go from `origin` to `opensource` via Bitbucket cross-repo PRs

2. **Before Creating PRs**:
   ```bash
   # Always check sync status first
   git fetch origin && git fetch opensource
   git log --oneline origin/main..opensource/main
   ```
   If commits are listed, the branches are out of sync and need attention before creating a PR.

3. **Commit Workflow**:
   - Develop on feature branches created from `origin/main`
   - Push to `origin` remote (not `opensource`)
   - Create cross-repo PRs via Bitbucket UI to `opensource`

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

Schema is in `drizzle/schema.ts`. To push schema changes:
```bash
npm run push
```

Note: This uses Drizzle Push which is fast but not safe for production.

## Common Tasks for Agents

### Creating a Feature
1. Read [OCEANMD_WORKFLOW.md](OCEANMD_WORKFLOW.md) first
2. Create branch from origin/main
3. Implement feature following Clean Architecture
4. Run tests and build
5. Check repo sync status
6. Push to origin and guide user to create cross-repo PR

### Fixing Bugs
1. Identify the issue location
2. Check if it's in business logic or infrastructure layer
3. Fix in appropriate layer
4. Add test if missing
5. Follow commit workflow from OCEANMD_WORKFLOW.md

### Refactoring
- Maintain Clean Architecture boundaries
- Don't mix business logic with infrastructure
- Keep changes focused and minimal
- Update tests as needed

## Key Files to Reference

- [README.md](README.md) - Project overview and setup
- [OCEANMD_WORKFLOW.md](OCEANMD_WORKFLOW.md) - **Required reading** for git workflow
- [HOSTING.md](HOSTING.md) - Deployment information
- `drizzle/schema.ts` - Database schema
- `src/entities/models/` - Business models
- `.cursorrules` - Cursor-specific development rules

## Anti-Patterns to Avoid

- ❌ Don't push to `opensource` remote directly
- ❌ Don't create PRs without checking sync status
- ❌ Don't skip the rebase when branches are behind
- ❌ Don't mix business logic with infrastructure code
- ❌ Don't force push without `--force-with-lease`
- ❌ Don't leave feature branches undeleted after merge

## When to Ask for Human Input

- When origin/main is behind opensource/main (someone needs to sync)
- When rebase conflicts are complex or ambiguous
- When architectural decisions affect multiple layers
- When security-sensitive code is involved (OAuth, encryption, etc.)
- When the task requires access to external services (Bitbucket, Ocean Portal, etc.)
