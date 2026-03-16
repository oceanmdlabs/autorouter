#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$CDK_DIR/.env.deploy}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing deploy env file: $ENV_FILE"
  echo "Create it from: $CDK_DIR/.env.deploy.example"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -n "${APP_SECRETS_SECRET_ID:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "AWS CLI is required when APP_SECRETS_SECRET_ID is set."
    exit 1
  fi

  secret_json="$(aws secretsmanager get-secret-value \
    --secret-id "$APP_SECRETS_SECRET_ID" \
    --query SecretString \
    --output text)"

  if [[ -z "$secret_json" || "$secret_json" == "None" ]]; then
    echo "Secret '$APP_SECRETS_SECRET_ID' does not contain SecretString JSON."
    exit 1
  fi

  # Import known keys from Secrets Manager only when not already set in env file.
  while IFS= read -r -d '' key && IFS= read -r -d '' value; do
    if [[ -z "${!key:-}" ]]; then
      export "$key=$value"
    fi
  done < <(SECRET_JSON="$secret_json" node -e '
    const data = JSON.parse(process.env.SECRET_JSON || "{}");
    const keys = [
      "NUXT_OAUTH_GOOGLE_CLIENT_ID",
      "NUXT_OAUTH_GOOGLE_CLIENT_SECRET",
      "NUXT_OAUTH_GITHUB_CLIENT_ID",
      "NUXT_OAUTH_GITHUB_CLIENT_SECRET",
      "NUXT_SESSION_PASSWORD",
      "ENCRYPTION_KEY",
      "JWT_SECRET",
      "PUBLIC_URL"
    ];
    for (const key of keys) {
      const val = data[key];
      if (typeof val === "string" && val.length > 0) {
        process.stdout.write(key + "\0" + val + "\0");
      }
    }
  ')
fi

required_vars=(
  NUXT_SESSION_PASSWORD
  ENCRYPTION_KEY
  JWT_SECRET
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required variable in $ENV_FILE: $var_name"
    exit 1
  fi
done

# OAuth providers are optional. If either value in a provider pair is missing,
# skip that provider by clearing both values.
if [[ -z "${NUXT_OAUTH_GOOGLE_CLIENT_ID:-}" || -z "${NUXT_OAUTH_GOOGLE_CLIENT_SECRET:-}" ]]; then
  unset NUXT_OAUTH_GOOGLE_CLIENT_ID
  unset NUXT_OAUTH_GOOGLE_CLIENT_SECRET
  echo "Google OAuth config incomplete; skipping Google OAuth env vars."
fi

if [[ -z "${NUXT_OAUTH_GITHUB_CLIENT_ID:-}" || -z "${NUXT_OAUTH_GITHUB_CLIENT_SECRET:-}" ]]; then
  unset NUXT_OAUTH_GITHUB_CLIENT_ID
  unset NUXT_OAUTH_GITHUB_CLIENT_SECRET
  echo "GitHub OAuth config incomplete; skipping GitHub OAuth env vars."
fi

app_env="$(node -e '
  const env = process.env;
  const out = {};
  if (env.NUXT_OAUTH_GOOGLE_CLIENT_ID) out.NUXT_OAUTH_GOOGLE_CLIENT_ID = env.NUXT_OAUTH_GOOGLE_CLIENT_ID;
  if (env.NUXT_OAUTH_GITHUB_CLIENT_ID) out.NUXT_OAUTH_GITHUB_CLIENT_ID = env.NUXT_OAUTH_GITHUB_CLIENT_ID;
  if (env.PUBLIC_URL) {
    out.URL = env.PUBLIC_URL;
    out.DEPLOY_URL = env.PUBLIC_URL;
  }
  process.stdout.write(JSON.stringify(out));
')"

app_secret_env="$(node -e '
  const env = process.env;
  const out = {
    NUXT_SESSION_PASSWORD: env.NUXT_SESSION_PASSWORD,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY,
    JWT_SECRET: env.JWT_SECRET
  };
  if (env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET) out.NUXT_OAUTH_GOOGLE_CLIENT_SECRET = env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET;
  if (env.NUXT_OAUTH_GITHUB_CLIENT_SECRET) out.NUXT_OAUTH_GITHUB_CLIENT_SECRET = env.NUXT_OAUTH_GITHUB_CLIENT_SECRET;
  process.stdout.write(JSON.stringify(out));
')"

cd "$CDK_DIR"
APP_ENV="$app_env" APP_SECRET_ENV="$app_secret_env" npm run cdk:deploy:app -- "$@"

stack_name="${CDK_STACK_NAME:-dev}-autorouter"
deploy_url="${PUBLIC_URL:-}"

if command -v aws >/dev/null 2>&1; then
  stack_url="$(aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query 'Stacks[0].Outputs[?OutputKey==`url`].OutputValue' \
    --output text 2>/dev/null || true)"

  if [[ -n "$stack_url" && "$stack_url" != "None" ]]; then
    deploy_url="$stack_url"
  fi
fi

echo
echo "Deployment complete."
if [[ -n "$deploy_url" ]]; then
  echo "App URL: $deploy_url"
fi
echo
echo "First system admin bootstrap (required on a new environment):"
echo "1. Sign in once with the Google or GitHub account that should become the first system admin."
echo "2. That first login creates the user row and determines the admin identifier:"
echo "   - Google subject = OAuth sub"
echo "   - GitHub subject = numeric OAuth user.id stored as text"
echo "3. While still signed in, open /api/_auth/session and note user.provider + user.subject."
if [[ -n "$deploy_url" ]]; then
  echo "   Session URL: ${deploy_url%/}/api/_auth/session"
else
  echo "   Session URL: https://<your-app-url>/api/_auth/session"
fi
echo
echo "   Database lookup fallback:"
echo '   npm run db:sql:aws -- --sql "select provider, subject, display_name, last_login_at from users order by last_login_at desc nulls last, created_at desc limit 10;"'
echo
echo "4. Insert the matching provider + subject into system_admin_allowlist."
echo
echo '   Aurora Data API environments:'
echo '   npm run db:sql:aws -- --sql "insert into system_admin_allowlist (provider, subject, notes, active) values ('\''google'\'', '\''REPLACE_WITH_SUBJECT'\'', '\''initial system admin'\'', true);"'
echo
echo "5. Log out and sign back in. System admin is assigned at login time."
echo
echo "For more detail, see infrastructure/cdk/README.md."
