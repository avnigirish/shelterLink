#!/usr/bin/env bash
# env-sync.sh — EnvironmentSync verification script
# Runs when DATA_MODE changes to PROD in .env.local
# Checks: AWS region set, DynamoDB table exists, db.ts has explicit region

set -euo pipefail

ENV_FILE="packages/dashboard/.env.local"
DB_FILE="packages/dashboard/src/lib/db.ts"

# ── 1. Read current env values ────────────────────────────────────────────────
DATA_MODE=$(grep -E '^DATA_MODE=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "")
AWS_REGION=$(grep -E '^AWS_REGION=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "us-east-1")
SHELTER_TABLE=$(grep -E '^SHELTER_TABLE=' "$ENV_FILE" 2>/dev/null | grep -v '^#' | cut -d= -f2 | tr -d '"' || echo "")

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         ShelterLink — EnvironmentSync            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  DATA_MODE    : ${DATA_MODE:-<not set>}"
echo "  AWS_REGION   : ${AWS_REGION}"
echo "  SHELTER_TABLE: ${SHELTER_TABLE:-<not set>}"
echo ""

# ── 2. Only run full checks when switching to PROD ────────────────────────────
if [ "$DATA_MODE" != "PROD" ]; then
  echo "  ✓ DATA_MODE is not PROD — no AWS checks needed."
  echo ""
  exit 0
fi

ERRORS=0

# ── 3. Check AWS_REGION is set ────────────────────────────────────────────────
if [ -z "$AWS_REGION" ]; then
  echo "  ✗ AWS_REGION is not set in $ENV_FILE"
  echo "    Fix: add  AWS_REGION=us-east-1  to $ENV_FILE"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ AWS_REGION is set: $AWS_REGION"
fi

# ── 4. Check SHELTER_TABLE is set and uncommented ─────────────────────────────
if [ -z "$SHELTER_TABLE" ]; then
  echo "  ✗ SHELTER_TABLE is not set (or is commented out) in $ENV_FILE"
  echo "    Fix: uncomment or add  SHELTER_TABLE=shelterlink-shelters"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ SHELTER_TABLE is set: $SHELTER_TABLE"
fi

# ── 5. Check AWS CLI is available ─────────────────────────────────────────────
if ! command -v aws &>/dev/null; then
  echo "  ✗ AWS CLI not found — cannot verify DynamoDB table"
  echo "    Install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ AWS CLI found: $(aws --version 2>&1 | head -1)"

  # ── 6. Verify DynamoDB table exists in the configured region ────────────────
  if [ -n "$SHELTER_TABLE" ]; then
    echo ""
    echo "  Checking DynamoDB table '$SHELTER_TABLE' in region '$AWS_REGION'..."
    TABLE_STATUS=$(AWS_DEFAULT_REGION="$AWS_REGION" aws dynamodb describe-table \
      --table-name "$SHELTER_TABLE" \
      --query 'Table.TableStatus' \
      --output text 2>&1 || echo "NOT_FOUND")

    if [ "$TABLE_STATUS" = "ACTIVE" ]; then
      echo "  ✓ Table '$SHELTER_TABLE' exists and is ACTIVE in $AWS_REGION"
    elif echo "$TABLE_STATUS" | grep -q "ResourceNotFoundException"; then
      echo "  ✗ Table '$SHELTER_TABLE' does NOT exist in region $AWS_REGION"
      echo "    Fix: run  cd packages/infra && npx cdk deploy"
      ERRORS=$((ERRORS + 1))
    elif echo "$TABLE_STATUS" | grep -q "UnrecognizedClientException\|InvalidClientTokenId\|ExpiredToken"; then
      echo "  ✗ AWS credentials are invalid or expired"
      echo "    Fix: update AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in $ENV_FILE"
      ERRORS=$((ERRORS + 1))
    else
      echo "  ✗ Unexpected table status: $TABLE_STATUS"
      ERRORS=$((ERRORS + 1))
    fi
  fi
fi

# ── 7. Verify db.ts has explicit region in DynamoDBClient constructor ─────────
echo ""
echo "  Checking $DB_FILE for explicit region..."
if grep -q "region:" "$DB_FILE" 2>/dev/null; then
  echo "  ✓ db.ts has explicit region in DynamoDBClient"
else
  echo "  ✗ db.ts is missing explicit region in DynamoDBClient constructor"
  echo "    Fix: ensure DynamoDBClient is initialized as:"
  echo "         new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })"
  ERRORS=$((ERRORS + 1))
fi

# ── 8. Summary ────────────────────────────────────────────────────────────────
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "  ✅ All checks passed — safe to run in PROD mode."
else
  echo "  ❌ $ERRORS check(s) failed — fix the issues above before running in PROD mode."
  echo "     See packages/dashboard/.env.local and packages/infra/lib/shelter-link-stack.ts"
fi
echo ""
exit $ERRORS
