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
   - Develop on feature branches created from `origin/main`
   - Push feature branches to `origin`
   - Create PRs targeting `main` in GitHub

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

## Key Files to Reference

- [README.md](README.md) - Project overview and setup
- [HOSTING.md](HOSTING.md) - Deployment information
- `drizzle/schema.ts` - Database schema
- `src/entities/models/` - Business models
