#!/usr/bin/env bash

set -euo pipefail

set -a
source "$(dirname "$0")/../.env.deploy"
set +a

STACK_NAME="${CDK_STACK_NAME:-dev}-autorouter"
REGION="${AWS_REGION:-ca-central-1}"
SINCE_WINDOW="${SINCE:-10m}"

LAMBDA_NAME="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`lambdaName`].OutputValue' \
  --output text)"

aws logs tail "/aws/lambda/$LAMBDA_NAME" \
  --region "$REGION" \
  --follow \
  --since "$SINCE_WINDOW"
