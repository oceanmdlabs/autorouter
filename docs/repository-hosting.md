# Repository hosting handoff

Ocean Autorouter is moving to the private [Ocean Labs project](https://bitbucket.org/oceanmd/workspace/projects/LABS) in OceanMD Bitbucket. The published state in `docs/repository-hosting.conf` controls the handoff. Until it says `active`, GitHub remains the code host. After activation, Bitbucket is the master copy for code and pull requests. New clones should use [Bitbucket](https://bitbucket.org/oceanmd/autorouter/src/main/).

Before any Git fetch, pull, push, or pull request from an existing checkout, run:

```sh
bash scripts/check-repository-hosting.sh
git remote -v
git status --short --branch
```

The helper reads the published state from the current `origin` default branch. It checks that Bitbucket contains the cutover commit before changing only the local `origin` fetch and push URLs. It does not touch files, commits, or branches. Stop if it reports an error. After switching, fetch Bitbucket and reconcile your branch before new work or a push; the helper deliberately does not merge or rebase a dirty or divergent checkout. If your existing checkout has a GitHub remote named `github` but no `origin`, rename that remote to `origin` before running the helper (`git remote rename github origin`).

[GitHub Issues](https://github.com/oceanmdlabs/autorouter/issues) remains the work tracker during the transition. Link issues from Bitbucket pull requests. Keep GitHub unarchived while its Issues tracker is active. Do not open new GitHub pull requests or push new development code there after Bitbucket becomes active.

This Git hosting change does not deploy the application or extension. Follow this repository's existing release instructions and checks.
