# System Design — ShelterLink

## Overview

ShelterLink is a real-time shelter capacity tracking platform built on a fully serverless AWS architecture. Non-technical shelter staff submit structured updates via a web form or SMS simulator; those updates are parsed, persisted, and pushed to a public Next.js dashboard within seconds. Volunteers, donors, and community members can browse live shelter state, coordinate via community chat, pledge donations, and interact with an AI Community Advocate — all without creating an account.

The architecture pivots away from AWS Pinpoint (pending SMS sandbox approval) and uses a **Lambda Function URL** as the public ingestion endpoint. AWS AppSync provides real-time GraphQL subscriptions for Community Chat. Amazon Bedrock (Claude / Nova) powers the AI Advocate with agentic tool execution.

---

## Architecture

```
Web Form / SMS Simulator
  → Lambda Function URL (Update_Processor)
  → DynamoDB shelterlink-data (RECORD#CURRENT + LOG#<ts>)
  → DynamoDB Stream → Stream Handler Lambda
  → SSE /api/updates → Browser (ShelterList, shelter detail)

Community Member (Browser)
  → POST /api/chat/[shelterId]  (Next.js route → DynamoDB shelterlink-chat)
  → AppSync Subscription onNewMessage → All connected clients (real-time)

Donor (Browser)
  → POST /api/donations  (Next.js route → DynamoDB shelterlink-donations)
  → Admin panel marks DELIVERED → PATCH /api/admin/donations/[id]

Admin (Browser, GitHub OAuth)
  → Next.js Admin Panel (NextAuth.js session guard)
  → POST /api/admin/shelters  → DynamoDB registry entry
  → PATCH /api/admin/shelters/[id]/inventory → DynamoDB UpdateItem

Volunteer / Donor (Browser)
  → POST /api/advocate  (Next.js route)
  → Amazon Bedrock ConverseCommand (Nova Pro / Claude 3.5 Sonnet)
  → PledgeTool → shelterlink-donations DynamoDB write
  → AlertTool  → shelterlink-chat DynamoDB write + AppSync push
```

### Mermaid — High-Level Data Flow

```mermaid
flowchart TD
    WF[Web Form / SMS Simulator] -->|POST JSON| LFU[Lambda Function URL]
    LFU --> UP[Update_Processor Lambda]
    UP -->|TransactWrite| DB[(shelterlink-data)]
    DB -->|DynamoDB Stream| SH[Stream Handler Lambda]
    SH -->|poll queue| SSE[/api/updates SSE]
    SSE -->|text/event-stream| DASH[Next.js Dashboard]

    CM[Community Member] -->|POST /api/chat| CHAT[(shelterlink-chat)]
    CHAT -->|AppSync Subscription| DASH

    DONOR[Donor] -->|POST /api/donations| DON[(shelterlink-donations)]
    ADMIN[Admin] -->|PATCH status| DON

    DASH -->|POST /api/advocate| ADV[Advocate API Route]
    ADV -->|ConverseCommand| BR[Amazon Bedrock]
    BR -->|PledgeTool| DON
    BR -->|AlertTool| CHAT
```

---

## Components and Interfaces

### 1. Ingestion Endpoint — Lambda Function URL

- Public HTTPS endpoint, no API Gateway required
- Accepts `POST` with JSON body: `{ phone: string, body: string }`
- CORS policy: `allowedOrigins` restricted to `NEXT_PUBLIC_ALLOWED_ORIGIN`
- Auth type: `NONE` (public) — authorization enforced inside the handler via registry lookup
- Returns `{ ok: true, confirmation: string }` on success
- Returns `{ ok: false, error: string }` with appropriate HTTP status on failure

**Environment variables:**
| Variable | Purpose |
|---|---|
| `SHELTER_TABLE` | DynamoDB table name (`shelterlink-data`) |
| `AWS_REGION` | Explicit region (defaults to `us-east-1`) |
| `LOG_LEVEL` | Powertools logger level |
| `PINPOINT_APP_ID` | `PENDING` — Pinpoint disabled until sandbox approved |

### 2. Update_Processor Lambda

- Runtime: Node.js 20.x, TypeScript compiled via esbuild
- Handles both Lambda Function URL (HTTP POST) and SQS (future Pinpoint re-enable)
- Discriminated by `isFunctionUrlEvent()` type guard on the event shape
- Processing pipeline:
  1. Rate-limit check (`RATELIMIT#<hashedPhone>` in DynamoDB)
  2. Registry lookup (`REGISTRY#<hashedPhone>` → `shelterId`)
  3. Parse SMS body via `Parser` module
  4. `TransactWrite`: `RECORD#CURRENT` + `LOG#<timestamp>` (90-day TTL)
  5. Return confirmation string
- Structured logging via `@aws-lambda-powertools/logger` — `maskPhone()` used on all log entries
- Module-level DynamoDB client for warm-invocation reuse

### 3. Parser Module (`packages/lambda/src/parser.ts`)

Parses the SMS-format update body into a `CapacityRecord`.

**Grammar:**
```
BEDS <current>/<total> [STATUS open|full|closed] [NEEDS <item>[:<priority>], ...] [FULFILLED <item>, ...]
```

- `BEDS` is required; all other fields are optional
- Case-insensitive, whitespace-tolerant (regex-based)
- Priority defaults to `MEDIUM` if omitted
- Status derived from occupancy if `STATUS` keyword absent (`beds >= capacity → FULL`)
- Returns discriminated union: `{ ok: true; record: CapacityRecord } | { ok: false; error: string }`

### 4. Pretty Printer Module (`packages/lambda/src/prettyPrinter.ts`)

Formats a `CapacityRecord` back into a human-readable confirmation string.

- `formatConfirmation(record)` → `"Updated: BEDS 12/20 STATUS OPEN NEEDS blankets:HIGH, water:CRITICAL"`
- `formatError(msg)` → `"Error: <msg>. Example: BEDS 12/20 NEEDS blankets:high, water:critical"`
- Output is round-trip safe: `parse(formatConfirmation(record))` produces an equivalent `CapacityRecord`

### 5. Stream Handler Lambda (`packages/lambda/src/streamHandler.ts`)

- Triggered by DynamoDB Streams on `shelterlink-data` (`NEW_AND_OLD_IMAGES`)
- Filters for `RECORD#CURRENT` changes only
- Writes update payloads to a connections table for SSE polling
- Batch size: 10, retry attempts: 2

### 6. Dashboard — Next.js 14 App Router

**Pages:**
| Route | Type | Description |
|---|---|---|
| `/` | SSR + SSE | Public shelter list with real-time updates |
| `/shelter/[id]` | SSR | Shelter detail: needs, inventory, chat, advocate |
| `/admin` | SSR (auth-gated) | Registry management, inventory, donations |
| `/donate/[shelterId]` | SSR | Public donation pledge form |
| `/login` | SSR | GitHub OAuth login |

**API Routes:**
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/updates` | GET | None | SSE stream of shelter updates |
| `/api/chat/[shelterId]` | GET/POST | None | Community chat messages |
| `/api/advocate` | POST | None (rate-limited) | AI Advocate |
| `/api/donations` | POST | None | Submit pledge |
| `/api/admin/shelters` | POST | Session | Add shelter to registry |
| `/api/admin/shelters/[id]` | DELETE | Session | Remove shelter |
| `/api/admin/shelters/[id]/inventory` | PATCH | Session | Update inventory |
| `/api/admin/donations` | GET | Session | List all pledges |
| `/api/admin/donations/[id]` | PATCH | Session | Mark pledge delivered |

**Mock mode:** `USE_MOCK_DATA=true` bypasses all AWS calls. Mock stores (`mockShelterStore`, `mockChatStore`, `mockDonations`) are in-memory and mutable for local dev.

### 7. Community Chat — AWS AppSync

- GraphQL API with DynamoDB data source (`shelterlink-chat`)
- Auth: API key (public read/write for demo; rotate before production)
- Schema:
  ```graphql
  type ChatMessage { roomId: String!, timestamp: String!, senderName: String!, message: String!, userType: String! }
  type Query    { getMessages(roomId: String!, limit: Int): [ChatMessage] }
  type Mutation { sendMessage(roomId: String!, senderName: String!, message: String!, userType: String!): ChatMessage }
  type Subscription { onNewMessage(roomId: String!): ChatMessage @aws_subscribe(mutations: ["sendMessage"]) }
  ```
- Dashboard also writes chat messages directly via `POST /api/chat/[shelterId]` (DynamoDB write) — AppSync subscription pushes to all connected clients

### 8. AI Community Advocate

See dedicated section below.

---

## Data Models

### Types (shared between Lambda and Dashboard)

```typescript
type Priority      = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type ShelterStatus = 'OPEN' | 'FULL' | 'CLOSED';
type UserType      = 'VOLUNTEER' | 'DONOR' | 'STAFF' | 'ADMIN';
type DonationStatus = 'PLEDGED' | 'IN_TRANSIT' | 'DELIVERED';

interface NeedsItem     { item: string; priority: Priority; fulfilled?: boolean; }
interface CapacityRecord { beds: number; capacity: number; status: ShelterStatus; needsList: NeedsItem[]; updatedAt?: string; }
interface ShelterRecord  { shelterId: string; name: string; address: string; phone: string; state: string; website?: string; beds: number; capacity: number; status: ShelterStatus; needsList: NeedsItem[]; inventory: Record<string, number>; updatedAt: string; }
interface ChatMessage    { roomId: string; timestamp: string; senderName: string; message: string; userType: UserType; }
interface DonationRecord { userId: string; donationId: string; shelterId: string; shelterName: string; donorName: string; donorEmail: string; items: DonationItem[]; status: DonationStatus; pledgedAt: string; deliveredAt?: string; notes?: string; }
```

> Types are intentionally duplicated between `packages/lambda/src/types.ts` and `packages/dashboard/src/types/shelter.ts` — no shared package, keeping the Lambda bundle lean.

### DynamoDB Tables

**Table: `shelterlink-data`** (single-table for shelter state, registry, rate-limit)

| PK | SK | Purpose |
|---|---|---|
| `SHELTER#<id>` | `RECORD#CURRENT` | Latest shelter state |
| `SHELTER#<id>` | `LOG#<ISO-ts>` | Audit log entry (TTL: 90 days) |
| `REGISTRY#<hashedPhone>` | `METADATA` | Phone → shelterId mapping |
| `RATELIMIT#<hashedPhone>` | `ATTEMPTS` | Unauthorized attempt counter |

- Streams: `NEW_AND_OLD_IMAGES` — triggers SSE push pipeline
- Billing: PAY_PER_REQUEST
- TTL attribute: `ttl`

**Table: `shelterlink-chat`**

| PK | SK | Key attributes |
|---|---|---|
| `ROOM#<shelterId>` | `MSG#<ISO-ts>` | `senderName`, `message`, `userType`, `ttl` (30 days) |

**Table: `shelterlink-donations`**

| PK | SK | Key attributes |
|---|---|---|
| `USER#<userId>` | `DONATION#<uuid>` | `shelterId`, `items`, `status`, `pledgedAt`, `deliveredAt` |

- GSI `shelterlink-donations-by-shelter`: PK=`shelterId`, SK=`pledgedAt` — enables admin "all pledges for shelter X" query

### Inventory

Stored as a DynamoDB `Map` attribute on the `RECORD#CURRENT` item: `{ "blankets": 12, "water_bottles": 50 }`. Updated atomically via `UpdateItem` with `SET inventory.#item = :qty`.

---

## AI Community Advocate

### Overview

The AI Community Advocate is a conversational assistant embedded in the dashboard. It uses Amazon Bedrock (currently `amazon.nova-pro-v1:0`, designed for `claude-3-5-sonnet-20241022`) with the **Converse API** to support agentic tool execution. Every response is grounded in live DynamoDB shelter data — the model cannot fabricate shelter names, bed counts, or needs.

```
Browser (AdvocateChat component)
  → POST /api/advocate  { message, shelterId?, context, history[] }
  → Fetch shelter data from DynamoDB (or mock)
  → Build system prompt with live shelter context
  → Bedrock ConverseCommand (agentic loop, max 3 iterations)
  → Tool execution: PledgeTool → shelterlink-donations, AlertTool → shelterlink-chat
  → Return { text: string, toolUsed?: string }
```

### Request Shape

```typescript
POST /api/advocate
{
  message:   string,                          // user's message
  shelterId?: string,                         // present on shelter detail pages
  context:   'home' | 'shelter',
  history?:  Array<{ role: 'user' | 'advocate'; text: string }> // last 10 turns
}
```

### System Prompt Construction

`buildShelterContext(shelters)` produces a structured block per shelter:
```
<name> (ID: <id>, <state>) — <status> — <beds>/<capacity> beds available
  CRITICAL needs: <items>
  HIGH needs: <items>
  Inventory: <item>: <qty>, ...
```

The system prompt instructs the model to:
- Only reference shelters in the context block
- Rank suggestions CRITICAL first, then HIGH
- End every response with a specific actionable next step
- Use `PledgeTool` only after explicit user confirmation of intent to donate
- Use `AlertTool` only when user explicitly asks to notify a shelter

### Agentic Tools

#### `PledgeTool`

Writes a donation pledge to `shelterlink-donations` on behalf of the user.

```typescript
{
  name: 'PledgeTool',
  inputSchema: {
    shelterId: string,   // required
    item:      string,   // required
    quantity?: number,   // default 1
    donorName?: string,  // default 'Anonymous'
  }
}
```

Side effect: auto-posts a pledge notification to the shelter's community chat via `AlertTool`.

#### `AlertTool`

Posts a coordination message to a shelter's community chat room.

```typescript
{
  name: 'AlertTool',
  inputSchema: {
    shelterId: string,  // required
    message:   string,  // required
  }
}
```

Writes to `shelterlink-chat` with `senderName: 'Community Advocate'`, `userType: 'ADMIN'`.

### Agentic Loop

```
1. Build messages array from history + current user message
2. Call ConverseCommand with system prompt + tool definitions
3. If stopReason === 'end_turn': extract text, strip <thinking> blocks, return
4. If stopReason === 'tool_use': execute each tool, push toolResult, loop (max 3 iterations)
5. On Bedrock error: return graceful fallback message (HTTP 200, no error details exposed)
```

### Rate Limiting

In-memory map keyed by IP (`x-forwarded-for` → `x-real-ip` → `'unknown'`). 20 requests/minute per IP. Resets on Lambda cold start — sufficient for demo/hackathon scope. Returns HTTP 429 on breach.

### IAM Requirements

```typescript
// Bedrock
{ actions: ['bedrock:InvokeModel', 'bedrock:Converse'], resources: ['*'] }
// DynamoDB writes for tools
{ actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'], resources: [donationsTable.tableArn, chatTable.tableArn] }
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Parser round-trip

*For any* valid `CapacityRecord`, formatting it with `formatConfirmation` then parsing the result with `parse` should produce an equivalent `CapacityRecord` (same beds, capacity, status, and active needs list).

**Validates: Requirements 1.6**

---

### Property 2: Case and whitespace tolerance

*For any* valid SMS update body, transforming it to uppercase, lowercase, or adding extra whitespace between tokens should produce the same parsed `CapacityRecord` as the original.

**Validates: Requirements 1.5**

---

### Property 3: Unauthorized sender rejection

*For any* phone number not present in the shelter registry, submitting an update via the Lambda Function URL should return HTTP 403 and leave the Data_Store unchanged.

**Validates: Requirements 1.2, 8.1**

---

### Property 4: Default priority assignment

*For any* needs item submitted without an explicit priority keyword, the parsed `NeedsItem` should have `priority === 'MEDIUM'`.

**Validates: Requirements 3.3**

---

### Property 5: Needs list priority ordering

*For any* shelter record with a non-empty `needsList`, the list displayed on the Dashboard should be ordered such that no item with a lower priority appears before an item with a higher priority (CRITICAL > HIGH > MEDIUM > LOW).

**Validates: Requirements 3.1**

---

### Property 6: Needs filter correctness

*For any* `needsList` and any selected priority filter, every item returned by the filter function should have a priority that matches the selected filter value.

**Validates: Requirements 3.4**

---

### Property 7: Fulfilled needs removal

*For any* SMS update containing a `FULFILLED` keyword, every item named in the `FULFILLED` segment should have `fulfilled: true` in the parsed `needsList`.

**Validates: Requirements 3.5**

---

### Property 8: Phone masking invariant

*For any* E.164 phone number, `maskPhone(phone)` should never return a string containing more than the last 4 digits of the original number, and should never equal the original phone string.

**Validates: Requirements 8.4**

---

### Property 9: Rate-limit suppression

*For any* phone number that has made 5 or more unauthorized attempts within the suppression window, subsequent calls to `checkRateLimit` should return `{ suppressed: true }`.

**Validates: Requirements 8.3**

---

### Property 10: Donation record completeness

*For any* pledge submission with valid inputs, the written `DonationRecord` should contain all required fields: `userId`, `donationId`, `shelterId`, `items` (non-empty), `status === 'PLEDGED'`, and `pledgedAt` (valid ISO timestamp).

**Validates: Requirements 6.2, 6.3**

---

### Property 11: Donation query ordering

*For any* set of donation records for a given shelter, querying via the GSI should return records in ascending `pledgedAt` order.

**Validates: Requirements 6.4**

---

### Property 12: Chat message TTL

*For any* chat message written to `shelterlink-chat`, the `ttl` attribute should equal approximately `floor(Date.now() / 1000) + 30 * 24 * 60 * 60` (within a 5-second tolerance).

**Validates: Requirements 5.6**

---

### Property 13: Chat message field completeness

*For any* `ChatMessage`, the rendered chat entry should contain the sender name, user type label, and a formatted timestamp.

**Validates: Requirements 5.3**

---

### Property 14: Chat query limit

*For any* shelter room with more than 50 messages, the `GET /api/chat/[shelterId]` endpoint should return at most 50 messages.

**Validates: Requirements 5.4**

---

### Property 15: Advocate rate limit enforcement

*For any* IP address, after 20 requests within a 60-second window, the 21st request to `POST /api/advocate` should return HTTP 429.

**Validates: Requirements 10.9**

---

### Property 16: Advocate shelter context fidelity

*For any* array of `ShelterRecord` objects passed to `buildShelterContext`, the resulting string should contain only shelter names, IDs, and needs items present in that array — no fabricated data.

**Validates: Requirements 10.2, 10.5**

---

## Error Handling

### Lambda Function URL

| Condition | HTTP Status | Response |
|---|---|---|
| Invalid JSON body | 400 | `{ ok: false, error: 'Invalid JSON body' }` |
| Missing `phone` or `body` fields | 400 | `{ ok: false, error: 'Missing required fields: phone, body' }` |
| Parse failure | 400 | `{ ok: false, error: '<parser error message>' }` |
| Unregistered phone | 403 | `{ ok: false, error: 'Request suppressed or unauthorized' }` |
| Rate-limited | 403 | `{ ok: false, error: 'Request suppressed or unauthorized' }` |
| DynamoDB error | 500 | `{ ok: false, error: 'Internal server error' }` |

### Dashboard API Routes

- Admin routes: 401 if no session, 403 if origin mismatch, 400 for missing fields
- Chat POST: 400 if message is empty or missing
- Donations POST: 400 for missing required fields
- Advocate POST: 429 on rate limit, 400 for invalid body, 200 with fallback text on Bedrock error (never expose raw error details to client)

### SSE Endpoint

- Heartbeat every 15 seconds (`: heartbeat\n\n`) to keep connections alive through proxies
- On DynamoDB poll error: logs error, continues polling — client retains last known state
- Client-side: `useShelterUpdates` hook tracks `lastUpdated` timestamp; displays stale-data warning if no event received within threshold

### Parser

- Returns `{ ok: false, error: string }` for all invalid inputs — never throws
- Caller always checks `result.ok` before accessing `result.record`
- `formatError` wraps the error message with an example of the correct format

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests catch concrete bugs with specific examples and edge cases
- Property tests verify universal correctness across randomized inputs

### Property-Based Testing

Library: **`fast-check`** (used in both `packages/lambda` and `packages/dashboard`)

- Minimum **100 iterations** per property test
- Each property test references its design property via a comment tag:
  ```typescript
  // Feature: shelter-link, Property 1: Parser round-trip
  ```
- Each correctness property above maps to exactly one property-based test
- Generators should cover edge cases: empty needs lists, zero beds, max capacity, all-whitespace items, unicode in shelter names

**Key property test files:**
| File | Properties covered |
|---|---|
| `packages/lambda/src/parser.roundtrip.test.ts` | P1, P2, P4, P7 |
| `packages/lambda/src/needs.roundtrip.test.ts` | P5, P6 |
| `packages/lambda/src/rateLimit.test.ts` | P9 |
| `packages/lambda/src/registry.test.ts` | P3, P8 |
| `packages/dashboard/src/lib/mockData.pbt.test.ts` | P10, P11, P16 |
| `packages/dashboard/src/app/api/chat/[shelterId]/route.pbt.test.ts` | P12, P13, P14 |
| `packages/dashboard/src/app/api/advocate/advocate.pbt.test.ts` | P15 |

### Unit Testing

Library: **Vitest** + `@testing-library/react` (dashboard), **Vitest** (lambda)

Unit tests focus on:
- Specific examples: known SMS strings → expected `CapacityRecord`
- Integration points: API route handlers with mocked DynamoDB
- Edge cases: empty needs list, zero capacity, FULFILLED items not in NEEDS list
- Error conditions: Bedrock unavailable, DynamoDB timeout, malformed JSON body
- Auth guard: admin routes return 401 without session

**Key unit test files:**
| File | Coverage |
|---|---|
| `packages/lambda/src/handler.test.ts` | Function URL path, SQS path, error cases |
| `packages/lambda/src/logging.test.ts` | maskPhone, structured log output |
| `packages/dashboard/src/app/api/advocate/advocate.test.ts` | Tool execution, fallback, rate limit |
| `packages/dashboard/src/app/api/admin/shelters/[id]/route.test.ts` | Auth guard, CRUD |
| `packages/dashboard/src/app/api/admin/shelters/[id]/inventory/route.test.ts` | Inventory update |
| `packages/dashboard/src/components/NeedsFilter.test.tsx` | Filter UI |
| `packages/dashboard/src/components/CommunityChat.test.tsx` | Chat rendering |
| `packages/dashboard/src/hooks/useShelterUpdates.test.ts` | SSE hook |
| `packages/dashboard/src/app/admin/page.test.tsx` | Admin page auth |
| `packages/dashboard/src/lib/db.test.ts` | Mock/real data toggle |

### Running Tests

```bash
# All packages
npm run test --workspaces

# Lambda only
cd packages/lambda && npm run test

# Dashboard only
cd packages/dashboard && npm run test

# With coverage
cd packages/lambda && npm run coverage
```

Always use `vitest --run` (not watch mode) for CI.

---

## Security

### Input Validation
- All POST body content treated as untrusted; parsed with strict regex
- DynamoDB writes use typed attribute schemas — no dynamic key injection
- Chat messages capped at 500 characters (enforced in AppSync schema and API route)

### CSRF & Origin Protection
- Admin routes validate `Origin` header against `NEXT_PUBLIC_ALLOWED_ORIGIN`
- NextAuth.js CSRF token validation on session-mutating routes
- Lambda Function URL CORS policy restricts `allowedOrigins`

### Authorization
- Admin routes: `getServerSession(authOptions)` — return 401 if no session
- Lambda execution role: least-privilege IAM, scoped to specific table ARNs
- AppSync API key: public read/write for demo — rotate and scope before production

### Data Privacy
- Phone numbers hashed (SHA-256) for all DynamoDB keys — raw E.164 never used as a key
- `maskPhone()` used on all log entries — raw digits never appear in CloudWatch
- Donor identity: `USER#anonymous` for advocate-initiated pledges

### Region Configuration

All AWS SDK clients must include an explicit region:

```typescript
new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })
new BedrockRuntimeClient({ region: process.env['BEDROCK_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1' })
```

This prevents silent region fallback failures in Lambda and Next.js server components.

---

## AWS Well-Architected Alignment

| Pillar | Implementation |
|---|---|
| Operational Excellence | CloudWatch alarms on Lambda error rate, DLQ depth, DynamoDB throttles; structured JSON logging via Powertools |
| Security | Least-privilege IAM, input validation, CSRF protection, phone masking, origin checks |
| Reliability | DynamoDB on-demand, Lambda SQS retries with DLQ (14-day retention), SSR fallback for Dashboard |
| Performance Efficiency | SSE over polling, AppSync subscriptions for chat, module-level SDK clients for Lambda warm reuse |
| Cost Optimization | Serverless pay-per-use, DynamoDB TTL on logs (90d) and chat (30d), no idle EC2 |
| Sustainability | No always-on compute; Lambda cold starts acceptable for update latency budget |

---

## Pinpoint Re-Enable Path

Pinpoint resources are commented out in `packages/infra/lib/shelter-link-stack.ts` pending SMS sandbox approval.

To re-enable:
1. Request SMS sandbox access in AWS Console → Amazon Pinpoint
2. Uncomment the `CfnApp`, `CfnSMSChannel`, IAM policy, and SSM parameter blocks in the CDK stack
3. Set `PINPOINT_APP_ID` and `ORIGINATION_NUMBER` environment variables on the Lambda
4. The SQS event source path in `handler.ts` is already wired and tested — no code changes required
