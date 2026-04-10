#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="${DEPLOY_ENV_FILE:-$CDK_DIR/.env.deploy}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ "${AUTOROUTER_SKIP_FULL_DEPLOY_WARNING:-}" != "1" ]]; then
  echo "Warning: deploy-app-and-migrate runs both the AWS app deploy and deployed DB migrations."
  echo "Use deploy-app-with-env for routine app-only changes that do not require schema or sequencing work."
  echo "Set AUTOROUTER_SKIP_FULL_DEPLOY_WARNING=1 to suppress this reminder."
  echo
fi

"$SCRIPT_DIR/deploy-app-with-env.sh" "$@"
cd "$CDK_DIR"
npm run db:migrate:apply
