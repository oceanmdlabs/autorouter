#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd -- "$CDK_DIR/../.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$CDK_DIR/.env.deploy}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing deploy env file: $ENV_FILE"
  echo "Create it from: $CDK_DIR/.env.deploy.example"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required for code-only deploys."
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required for code-only deploys."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

stack_name="${CDK_STACK_NAME:-dev}-autorouter"

cd "$REPO_ROOT"
npm run build:aws

lambda_name="$(aws cloudformation describe-stacks \
  --stack-name "$stack_name" \
  --query 'Stacks[0].Outputs[?OutputKey==`lambdaName`].OutputValue' \
  --output text)"

if [[ -z "$lambda_name" || "$lambda_name" == "None" ]]; then
  echo "Could not find lambdaName output in stack '$stack_name'."
  echo "Run a full CDK deploy first so the stack exists and exports the Lambda name."
  exit 1
fi

archive_path="$(mktemp -d)/autorouter-lambda.zip"
trap 'rm -f "$archive_path"' EXIT

(
  cd "$REPO_ROOT/.output"
  zip -qr "$archive_path" .
)

echo "Updating Lambda code for $lambda_name from local .output bundle..."

aws lambda update-function-code \
  --function-name "$lambda_name" \
  --zip-file "fileb://$archive_path" \
  >/dev/null

aws lambda wait function-updated \
  --function-name "$lambda_name"

echo "Code-only deploy complete."
echo "Updated Lambda: $lambda_name"
echo "Stack left unchanged: $stack_name"
echo "Use the CDK deploy path when env, infra, or DB behavior changes."
