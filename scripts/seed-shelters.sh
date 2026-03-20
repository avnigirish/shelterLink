#!/usr/bin/env bash
# Seed real shelter records into DynamoDB (PROD mode)
# Usage: bash scripts/seed-shelters.sh
# Reads credentials from packages/dashboard/.env.local

set -euo pipefail

set -a && source packages/dashboard/.env.local && set +a

TABLE="${SHELTER_TABLE:-shelterlink-data}"
REGION="${AWS_REGION:-us-east-1}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Seeding shelters into table: $TABLE (region: $REGION)"
echo ""

put_shelter() {
  aws dynamodb put-item \
    --table-name "$TABLE" \
    --region "$REGION" \
    --item "$1" \
    --output text > /dev/null
}

put_shelter '{
  "PK":{"S":"SHELTER#shelter-001"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-001"},"name":{"S":"Helping Hands of Springfield"},
  "address":{"S":"2200 Shale St, Springfield, IL 62703"},"phone":{"S":"(217) 522-0048"},
  "beds":{"N":"14"},"capacity":{"N":"40"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"blankets"},"priority":{"S":"CRITICAL"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"water bottles"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"canned food"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"socks"},"priority":{"S":"LOW"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"blankets":{"N":"5"},"water bottles":{"N":"12"},"canned food":{"N":"30"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-001: Helping Hands of Springfield"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-002"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-002"},"name":{"S":"Contact Ministries"},
  "address":{"S":"1100 E Adams St, Springfield, IL 62703"},"phone":{"S":"(217) 753-3939"},
  "beds":{"N":"0"},"capacity":{"N":"30"},"status":{"S":"FULL"},
  "needsList":{"L":[
    {"M":{"item":{"S":"diapers"},"priority":{"S":"CRITICAL"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"baby formula"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"hygiene kits"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"diapers":{"N":"0"},"baby formula":{"N":"2"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-002: Contact Ministries"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-003"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-003"},"name":{"S":"Sojourn Shelter and Services"},
  "address":{"S":"1800 Westchester Blvd, Springfield, IL 62704"},"phone":{"S":"(217) 726-5100"},
  "beds":{"N":"8"},"capacity":{"N":"25"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"clothing (women)"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"toiletries"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"blankets":{"N":"20"},"hygiene kits":{"N":"15"},"canned food":{"N":"50"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-003: Sojourn Shelter and Services"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-004"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-004"},"name":{"S":"Inner City Mission"},
  "address":{"S":"1301 S Martin Luther King Jr Dr, Springfield, IL 62703"},"phone":{"S":"(217) 525-3940"},
  "beds":{"N":"0"},"capacity":{"N":"20"},"status":{"S":"CLOSED"},
  "needsList":{"L":[
    {"M":{"item":{"S":"volunteers"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"cleaning supplies"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-004: Inner City Mission"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-005"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-005"},"name":{"S":"Salvation Army Adult Rehabilitation Center"},
  "address":{"S":"1501 N 19th St, Springfield, IL 62703"},"phone":{"S":"(217) 528-7573"},
  "beds":{"N":"22"},"capacity":{"N":"60"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"work boots"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"toiletries"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"reading glasses"},"priority":{"S":"LOW"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"canned food":{"N":"80"},"clothing":{"N":"40"},"blankets":{"N":"30"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-005: Salvation Army Adult Rehabilitation Center"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-006"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-006"},"name":{"S":"Rutledge Youth Foundation"},
  "address":{"S":"2420 Pasfield St, Springfield, IL 62702"},"phone":{"S":"(217) 525-7757"},
  "beds":{"N":"5"},"capacity":{"N":"18"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"school supplies"},"priority":{"S":"CRITICAL"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"backpacks"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"snacks"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"backpacks":{"N":"3"},"school supplies":{"N":"10"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-006: Rutledge Youth Foundation"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-007"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-007"},"name":{"S":"Mercy Communities Springfield"},
  "address":{"S":"624 S 7th St, Springfield, IL 62702"},"phone":{"S":"(217) 753-1358"},
  "beds":{"N":"3"},"capacity":{"N":"16"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"diapers"},"priority":{"S":"CRITICAL"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"strollers"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"children clothing"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"diapers":{"N":"8"},"baby formula":{"N":"5"},"blankets":{"N":"12"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-007: Mercy Communities Springfield"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-008"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-008"},"name":{"S":"Family Guidance Centers Triangle Center"},
  "address":{"S":"2401 E Washington St, Springfield, IL 62703"},"phone":{"S":"(217) 544-9858"},
  "beds":{"N":"2"},"capacity":{"N":"6"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"hygiene kits"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"warm clothing"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"hygiene kits":{"N":"4"},"blankets":{"N":"6"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-008: Family Guidance Centers Triangle Center"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-009"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-009"},"name":{"S":"Springfield Housing Authority"},
  "address":{"S":"200 N 11th St, Springfield, IL 62703"},"phone":{"S":"(217) 753-5757"},
  "beds":{"N":"0"},"capacity":{"N":"50"},"status":{"S":"FULL"},
  "needsList":{"L":[
    {"M":{"item":{"S":"furniture donations"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"kitchen supplies"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-009: Springfield Housing Authority"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-010"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-010"},"name":{"S":"Prairie Center Against Sexual Assault"},
  "address":{"S":"208 S Mauvaisterre St, Jacksonville, IL 62650"},"phone":{"S":"(217) 744-2560"},
  "beds":{"N":"6"},"capacity":{"N":"12"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"clothing (women)"},"priority":{"S":"CRITICAL"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"toiletries"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"gift cards"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"toiletries":{"N":"10"},"blankets":{"N":"8"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-010: Prairie Center Against Sexual Assault"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-011"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-011"},"name":{"S":"Central Illinois Foodbank Emergency Shelter"},
  "address":{"S":"2301 W Iles Ave, Springfield, IL 62704"},"phone":{"S":"(217) 522-4022"},
  "beds":{"N":"18"},"capacity":{"N":"35"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"canned vegetables"},"priority":{"S":"CRITICAL"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"peanut butter"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"pasta"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"cooking oil"},"priority":{"S":"LOW"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"canned food":{"N":"120"},"pasta":{"N":"45"},"peanut butter":{"N":"20"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-011: Central Illinois Foodbank Emergency Shelter"

put_shelter '{
  "PK":{"S":"SHELTER#shelter-012"},"SK":{"S":"RECORD#CURRENT"},
  "shelterId":{"S":"shelter-012"},"name":{"S":"Heartland YMCA Emergency Housing"},
  "address":{"S":"701 S 4th St, Springfield, IL 62703"},"phone":{"S":"(217) 544-9846"},
  "beds":{"N":"10"},"capacity":{"N":"28"},"status":{"S":"OPEN"},
  "needsList":{"L":[
    {"M":{"item":{"S":"towels"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"soap"},"priority":{"S":"HIGH"},"fulfilled":{"BOOL":false}}},
    {"M":{"item":{"S":"shampoo"},"priority":{"S":"MEDIUM"},"fulfilled":{"BOOL":false}}}
  ]},
  "inventory":{"M":{"towels":{"N":"15"},"soap":{"N":"30"},"shampoo":{"N":"12"}}},
  "updatedAt":{"S":"'"$NOW"'"}}'
echo "✓ shelter-012: Heartland YMCA Emergency Housing"

echo ""
echo "Done — 12 shelters seeded into $TABLE"
