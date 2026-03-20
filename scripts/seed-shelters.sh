#!/usr/bin/env bash
# Seed real shelter records into DynamoDB (PROD mode)
# Usage: bash scripts/seed-shelters.sh
# Reads credentials from packages/dashboard/.env.local

set -euo pipefail

# Load env vars
set -a && source packages/dashboard/.env.local && set +a

TABLE="${SHELTER_TABLE:-shelterlink-data}"
REGION="${AWS_REGION:-us-east-1}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Seeding shelters into table: $TABLE (region: $REGION)"
echo ""

put_shelter() {
  local json="$1"
  aws dynamodb put-item \
    --table-name "$TABLE" \
    --region "$REGION" \
    --item "$json" \
    --output text > /dev/null
}

# ---------------------------------------------------------------------------
# Shelter 1 — Helping Hands of Springfield
# ---------------------------------------------------------------------------
put_shelter '{
  "PK":         {"S": "SHELTER#shelter-001"},
  "SK":         {"S": "RECORD#CURRENT"},
  "shelterId":  {"S": "shelter-001"},
  "name":       {"S": "Helping Hands of Springfield"},
  "address":    {"S": "2200 Shale St, Springfield, IL 62703"},
  "phone":      {"S": "(217) 522-0048"},
  "beds":       {"N": "14"},
  "capacity":   {"N": "40"},
  "status":     {"S": "OPEN"},
  "needsList":  {"L": [
    {"M": {"item": {"S": "blankets"},      "priority": {"S": "CRITICAL"}, "fulfilled": {"BOOL": false}}},
    {"M": {"item": {"S": "water bottles"}, "priority": {"S": "HIGH"},     "fulfilled": {"BOOL": false}}},
    {"M": {"item": {"S": "canned food"},   "priority": {"S": "MEDIUM"},   "fulfilled": {"BOOL": false}}}
  ]},
  "inventory":  {"M": {
    "blankets":      {"N": "5"},
    "water bottles": {"N": "12"},
    "canned food":   {"N": "30"}
  }},
  "updatedAt":  {"S": "'"$NOW"'"}
}'
echo "✓ shelter-001: Helping Hands of Springfield"

# ---------------------------------------------------------------------------
# Shelter 2 — Contact Ministries
# ---------------------------------------------------------------------------
put_shelter '{
  "PK":         {"S": "SHELTER#shelter-002"},
  "SK":         {"S": "RECORD#CURRENT"},
  "shelterId":  {"S": "shelter-002"},
  "name":       {"S": "Contact Ministries"},
  "address":    {"S": "1100 E Adams St, Springfield, IL 62703"},
  "phone":      {"S": "(217) 753-3939"},
  "beds":       {"N": "0"},
  "capacity":   {"N": "30"},
  "status":     {"S": "FULL"},
  "needsList":  {"L": [
    {"M": {"item": {"S": "diapers"},      "priority": {"S": "CRITICAL"}, "fulfilled": {"BOOL": false}}},
    {"M": {"item": {"S": "baby formula"}, "priority": {"S": "HIGH"},     "fulfilled": {"BOOL": false}}},
    {"M": {"item": {"S": "hygiene kits"}, "priority": {"S": "MEDIUM"},   "fulfilled": {"BOOL": false}}}
  ]},
  "inventory":  {"M": {
    "diapers":      {"N": "0"},
    "baby formula": {"N": "2"}
  }},
  "updatedAt":  {"S": "'"$NOW"'"}
}'
echo "✓ shelter-002: Contact Ministries"

# ---------------------------------------------------------------------------
# Shelter 3 — Sojourn Shelter and Services
# ---------------------------------------------------------------------------
put_shelter '{
  "PK":         {"S": "SHELTER#shelter-003"},
  "SK":         {"S": "RECORD#CURRENT"},
  "shelterId":  {"S": "shelter-003"},
  "name":       {"S": "Sojourn Shelter and Services"},
  "address":    {"S": "1800 Westchester Blvd, Springfield, IL 62704"},
  "phone":      {"S": "(217) 726-5100"},
  "beds":       {"N": "8"},
  "capacity":   {"N": "25"},
  "status":     {"S": "OPEN"},
  "needsList":  {"L": []},
  "inventory":  {"M": {
    "blankets":     {"N": "20"},
    "hygiene kits": {"N": "15"},
    "canned food":  {"N": "50"}
  }},
  "updatedAt":  {"S": "'"$NOW"'"}
}'
echo "✓ shelter-003: Sojourn Shelter and Services"

# ---------------------------------------------------------------------------
# Shelter 4 — Inner City Mission
# ---------------------------------------------------------------------------
put_shelter '{
  "PK":         {"S": "SHELTER#shelter-004"},
  "SK":         {"S": "RECORD#CURRENT"},
  "shelterId":  {"S": "shelter-004"},
  "name":       {"S": "Inner City Mission"},
  "address":    {"S": "1301 S Martin Luther King Jr Dr, Springfield, IL 62703"},
  "phone":      {"S": "(217) 525-3940"},
  "beds":       {"N": "0"},
  "capacity":   {"N": "20"},
  "status":     {"S": "CLOSED"},
  "needsList":  {"L": [
    {"M": {"item": {"S": "volunteers"},        "priority": {"S": "HIGH"},   "fulfilled": {"BOOL": false}}},
    {"M": {"item": {"S": "cleaning supplies"}, "priority": {"S": "MEDIUM"}, "fulfilled": {"BOOL": false}}}
  ]},
  "inventory":  {"M": {}},
  "updatedAt":  {"S": "'"$NOW"'"}
}'
echo "✓ shelter-004: Inner City Mission"

echo ""
echo "Done — 4 shelters seeded into $TABLE"
echo "Refresh the dashboard to see them."
