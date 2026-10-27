#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'Repository hosting check failed: %s\n' "$*" >&2
  exit 1
}

root=$(git rev-parse --show-toplevel 2>/dev/null) || die 'run this inside a Git checkout'
cd "$root"
local_config=docs/repository-hosting.conf
[[ -f "$local_config" ]] || die "missing $local_config; fetch the GitHub default branch and read AGENTS.md"

read_field() {
  local key=$1 file=$2
  sed -n "s/^${key}=//p" "$file" | head -n 1
}

default_branch=$(read_field default_branch "$local_config")
source_url=$(read_field source_url "$local_config")
[[ -n "$default_branch" && -n "$source_url" ]] || die 'incomplete local hosting configuration'

origin_url=$(git remote get-url origin 2>/dev/null) || die 'origin is missing'
source_https=${source_url%.git}
source_ssh="git@github.com:${source_https#https://github.com/}.git"
if [[ "$origin_url" == "$source_url" || "$origin_url" == "$source_https" || "$origin_url" == "$source_ssh" ]]; then
  git fetch origin "$default_branch" >/dev/null
  origin_is_source=1
else
  git fetch origin "$default_branch" >/dev/null
  origin_is_source=0
fi

remote_config=$(mktemp)
trap 'rm -f "$remote_config"' EXIT
git show "FETCH_HEAD:$local_config" > "$remote_config" || die 'hosting status is missing on the fetched default branch'
state=$(read_field state "$remote_config")
published_source=$(read_field source_url "$remote_config")
target_url=$(read_field target_url "$remote_config")
published_branch=$(read_field default_branch "$remote_config")
[[ "$published_source" == "$source_url" && "$published_branch" == "$default_branch" ]] || die 'published repository identity does not match this checkout'

case "$state" in
  preparing)
    [[ "$origin_is_source" == 1 ]] || die 'cutover is still preparing but origin is not the expected GitHub repository'
    printf 'GitHub remains the active code host; no local configuration changed.\n'
    exit 0
    ;;
  active)
    [[ -n "$target_url" ]] || die 'active status has no Bitbucket target URL'
    [[ "$origin_is_source" == 1 || "$origin_url" == "$target_url" ]] || die 'origin is neither the expected GitHub source nor the approved Bitbucket target'
    ;;
  *) die "unknown hosting state: $state" ;;
esac

source_head=$(git rev-parse FETCH_HEAD)
git fetch --no-tags "$target_url" "refs/heads/$default_branch" >/dev/null || die 'cannot fetch the Bitbucket default branch'
target_head=$(git rev-parse FETCH_HEAD)
git merge-base --is-ancestor "$source_head" "$target_head" || die 'Bitbucket default branch does not contain the published cutover commit'

if [[ "$origin_is_source" == 1 ]]; then
  git remote set-url origin "$target_url"
  git config --local --unset-all remote.origin.pushurl 2>/dev/null || true
  git config --local remote.pushDefault origin
  git fetch origin "$default_branch" >/dev/null
fi

fetch_urls=$(git remote get-url --all origin)
[[ "$fetch_urls" == "$target_url" ]] || die 'origin has an unexpected fetch URL'
push_urls=$(git remote get-url --push --all origin)
[[ "$push_urls" == "$target_url" ]] || die 'origin has an unexpected push URL'
current_branch=$(git branch --show-current)
if [[ -n "$current_branch" ]]; then
  branch_remote=$(git config --local --get "branch.$current_branch.remote" || true)
  branch_push_remote=$(git config --local --get "branch.$current_branch.pushRemote" || true)
  [[ -z "$branch_remote" || "$branch_remote" == origin ]] || die "current branch tracks another remote: $branch_remote"
  [[ -z "$branch_push_remote" || "$branch_push_remote" == origin ]] || die "current branch pushes to another remote: $branch_push_remote"
fi
printf 'Bitbucket is the active code host; origin fetch and push URLs are verified.\n'
printf 'Read the latest Bitbucket AGENTS.md and reconcile your branch before new work.\n'
