# DynamoDB Schema — ShelterLink

## Overview

ShelterLink uses three DynamoDB tables. Each table uses on-demand billing and has TTL enabled where appropriate.

---

## Table 1: `shelterlink-shelters`

Primary shelter state, audit log, registry, and rate-limit records.

| Attribute | Type | Description |
|---|---|---|
| `PK` | String | Partition key |
| `SK` | String | Sort key |
| `shelterId` | String | Unique shelter identifier (UUID) |
| `name` | String | Shelter display name |
| `address` | String | Street address |
| `phone` | String | E.164 format phone number (registry only) |
| `beds` | Number | Current available beds |
| `capacity` | Number | Total bed capacity |
| `status` | String | `OPEN` \| `FULL` \| `CLOSED` |
| `needsList` | List | `[{ item: string, priority: string, fulfilled: boolean }]` |
| `inventory` | Map | `{ "blankets": 12, "water_bottles": 50, ... }` — item name → quantity |
| `updatedAt` | String | ISO 8601 timestamp of last update |
| `ttl` | Number | Unix epoch — set on `LOG#` entries (90-day expiry) |

### Access Patterns

| Pattern | PK | SK |
|---|---|---|
| Get current shelter state | `SHELTER#<shelterId>` | `RECORD#CURRENT` |
| Get audit log for shelter | `SHELTER#<shelterId>` | begins_with `LOG#` |
| Get all shelters (scan) | — | filter SK = `RECORD#CURRENT` |
| Registry lookup by phone | `REGISTRY#<hashedPhone>` | `SHELTER#<shelterId>` |
| Rate-limit record | `RATELIMIT#<hashedPhone>` | `ATTEMPTS` |

### DynamoDB Streams
Enabled with `NEW_AND_OLD_IMAGES` — triggers SSE push Lambda on `RECORD#CURRENT` changes.

---

## Table 2: `shelterlink-chat`

Community chat messages per shelter room.

| Attribute | Type | Description |
|---|---|---|
| `PK` | String | `ROOM#<shelterId>` |
| `SK` | String | `MSG#<ISO-timestamp>` |
| `senderName` | String | Display name of the sender |
| `message` | String | Message body (max 500 chars) |
| `userType` | String | `VOLUNTEER` \| `DONOR` \| `STAFF` \| `ADMIN` |
| `createdAt` | String | ISO 8601 timestamp |
| `ttl` | Number | Unix epoch — 30-day expiry |

### Access Patterns

| Pattern | PK | SK |
|---|---|---|
| Get recent messages for room | `ROOM#<shelterId>` | begins_with `MSG#`, sort descending, limit N |
| Send new message | `ROOM#<shelterId>` | `MSG#<timestamp>` |

### AppSync Integration
AppSync uses this table as a DynamoDB data source. Mutations write directly; subscriptions are managed by AppSync connection state (no custom connection table needed).

---

## Table 3: `shelterlink-donations`

User donation pledges linked to shelters.

| Attribute | Type | Description |
|---|---|---|
| `PK` | String | `USER#<userId>` |
| `SK` | String | `DONATION#<donationId>` (UUID) |
| `shelterId` | String | Target shelter ID |
| `shelterName` | String | Denormalized shelter name for display |
| `items` | List | `[{ item: string, quantity: number }]` |
| `status` | String | `PLEDGED` \| `IN_TRANSIT` \| `DELIVERED` |
| `pledgedAt` | String | ISO 8601 timestamp |
| `deliveredAt` | String | ISO 8601 timestamp (set when status → DELIVERED) |
| `notes` | String | Optional donor notes |

### Access Patterns

| Pattern | PK | SK |
|---|---|---|
| Get all donations by user | `USER#<userId>` | begins_with `DONATION#` |
| Get single donation | `USER#<userId>` | `DONATION#<donationId>` |
| Get all donations for shelter (GSI) | GSI: `shelterId` | — |

### GSI: `shelterlink-donations-by-shelter`
- Partition key: `shelterId`
- Sort key: `pledgedAt`
- Projection: ALL
- Enables admin view: "all pledges for shelter X"

---

## Key Design Decisions

- **Inventory as a Map attribute** on the Shelter record — avoids a separate table for simple item:quantity tracking; updated atomically via `UpdateItem` with `SET inventory.#item = :qty`
- **Chat TTL at 30 days** — keeps the table lean; historical chat is not a core requirement
- **Donations GSI** — allows the admin panel to query "what's coming to this shelter" without a full scan
- **Phone numbers hashed** in registry and rate-limit keys — raw E.164 numbers never used as DynamoDB keys
