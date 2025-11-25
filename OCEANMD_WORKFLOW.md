# OceanMD Development Workflow

## Repository Setup

This project uses a **dual-repository workflow**:

- **Internal Repo (`origin`)**: `bitbucket.org:oceanmd/service-request-autorouter` (private)
- **Open Source Repo (`opensource`)**: `bitbucket.org:oceanmd_oss/service-request-autorouter` (public)

All development happens in the internal repo first, then changes are submitted to the open source repo via cross-repository pull requests in Bitbucket.

## Daily Development Workflow

### 1. Starting a New Feature

```bash
# Make sure you're on the latest internal main
git checkout main
git pull origin main

# Create your feature branch from origin/main
git checkout -b feature/your-feature-name
```

### 2. During Development

Work normally on your feature branch. Commit often:

```bash
git add .
git commit -m "Your commit message"
```

**If working on a feature for multiple days**, periodically sync with origin/main to avoid conflicts:

```bash
git fetch origin
git rebase origin/main
```

### 3. Before Creating a Pull Request

**CRITICAL: Check if your branch is behind the open source repo**

```bash
# Fetch latest from both remotes
git fetch origin
git fetch opensource

# Check if origin/main is behind opensource/main
git log --oneline origin/main..opensource/main
```

**If there are commits listed:**
- Someone needs to sync origin/main with opensource/main first (see "Syncing Repositories" below)
- After syncing, rebase your feature branch: `git rebase origin/main`

**If no commits listed, proceed:**

```bash
# Rebase your feature on origin/main
git checkout feature/your-feature-name
git rebase origin/main

# Push to internal repo (use --force-with-lease after rebase)
git push origin feature/your-feature-name --force-with-lease
```

### 4. Creating the Cross-Repo Pull Request

1. Go to Bitbucket at `bitbucket.org/oceanmd/service-request-autorouter`
2. Create a pull request
3. **Set the destination** to `oceanmd_oss/service-request-autorouter` (the open source repo)
4. Set the source to your feature branch from the internal repo

Bitbucket will automatically support cross-repository PRs between these repos.

### 5. After PR is Merged

Clean up your local and remote branches:

```bash
# Switch back to main and update
git checkout main
git pull origin main

# Delete local feature branch
git branch -d feature/your-feature-name

# Delete remote feature branch
git push origin --delete feature/your-feature-name

# Clean up stale remote-tracking branches
git fetch --prune
```

## Syncing Repositories

**Someone with write access to both repos** should regularly sync them:

```bash
# Sync internal main with open source main (do this weekly or before PRs)
git checkout main
git fetch opensource
git merge opensource/main
git push origin main
```

This ensures origin/main stays current with opensource/main, preventing "branch behind" issues.

## Troubleshooting

### "Pull request is X commits behind"

This happens when opensource/main has moved ahead of your feature branch. Fix it:

```bash
# Fetch latest from opensource
git fetch opensource

# Rebase your feature branch onto opensource/main
git checkout feature/your-feature-name
git rebase opensource/main

# If conflicts occur, resolve them, then:
git add .
git rebase --continue

# Force push the rebased branch
git push origin feature/your-feature-name --force-with-lease
```

The cross-repo PR will automatically update.

### Rebase vs Merge

For feature branches going to open source:
- **Use `git rebase`** for cleaner linear history (preferred)
- **Use `git merge`** only if multiple people are working on the same feature branch

## Quick Reference

```bash
# Check if your branch needs updating
git fetch opensource
git log --oneline HEAD..opensource/main

# Sync with origin/main during development
git fetch origin && git rebase origin/main

# Before creating PR
git fetch origin && git fetch opensource
git log --oneline origin/main..opensource/main  # Should be empty
git rebase origin/main
git push origin feature/your-branch --force-with-lease

# After PR merged
git checkout main && git pull origin main
git branch -d feature/your-branch
git push origin --delete feature/your-branch
```

## Git Aliases (Optional)

Add these to `~/.gitconfig` for convenience:

```ini
[alias]
    # Check if origin/main is behind opensource/main
    check-sync = !git fetch origin && git fetch opensource && git log --oneline origin/main..opensource/main

    # Sync with origin/main
    sync = !git fetch origin && git rebase origin/main

    # Safe force push after rebase
    pushf = push --force-with-lease
```

Usage:
```bash
git check-sync  # Check if repos need syncing
git sync        # Rebase on origin/main
git pushf       # Force push safely
```
