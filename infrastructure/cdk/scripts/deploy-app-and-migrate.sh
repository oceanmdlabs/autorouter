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

"$SCRIPT_DIR/deploy-app-with-env.sh" "$@"
cd "$CDK_DIR"
npm run db:migrate:apply
