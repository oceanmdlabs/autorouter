# review-prs - Review Open PRs For Merge Readiness

Review all open pull requests in the current GitHub repository so the user can decide what is ready to merge.

## Task

Find open PRs for this repository, inspect each change with a code-review stance, run practical verification, and submit a GitHub review when there is enough evidence.

## Workflow

1. Resolve repository context from the local checkout:
   ```bash
   git status --short --branch
   git remote -v
   git fetch origin
   ```

2. List open PRs for the resolved repository, sorted by recent activity.

3. For each open PR:
   - Fetch metadata, changed files, comments, and diff.
   - Create a temporary worktree from the PR head instead of changing the user's current branch.
   - Read the changed files and relevant surrounding code.
   - Prioritize findings that affect correctness, security, tenant isolation, data integrity, deployment behavior, or missing tests.
   - Run the strongest practical checks for the change, normally:
     ```bash
     npm run typecheck
     npm run test -- --run
     ```
   - Do not approve if tests fail for task-related reasons or if there are unresolved blocking findings.

4. Submit the review on GitHub:
   - `APPROVE` only when the PR is merge-ready.
   - `REQUEST_CHANGES` for blocking correctness, security, or data-integrity issues.
   - `COMMENT` when there are only non-blocking notes or verification could not be completed.

5. Report a concise merge summary:
   - PR number and title
   - review decision
   - checks run and result
   - blocking findings, if any
   - non-blocking risks or follow-up notes

## Review Standards

- Treat this app as tenant-sensitive healthcare routing software.
- Protect tenant isolation and PHI handling.
- Keep business logic in `src/application` and entities, and framework/database specifics in `src/infrastructure` or `server`.
- Follow `AGENTS.md` and `DATABASE_MIGRATION_POLICY.md`.
- Do not leave the user's current branch changed after review work.
