# System Design — ShelterLink (Pivoted Architecture)

## Architecture Overview

ShelterLink uses a fully serverless, event-driven architecture on AWS. The original Pinpoint SMS gateway has been replaced with a **Lambda Function URL** as a public webhook endpoint, enabling direct HTTP-based status updates from a web form or SMS simulator. AWS AppSync provides real-time GraphQL subscriptions for the Community Chat feature.

```
Web Form / SMS Simulator
  → Lambda Function URL (Update_Processor)
  → AWS DynamoDB (Shelters table)
  → Next.js Dashboard (SSE + AppSync subscriptions)
  → Volunteer / Donor / Community Member (Browser)

Community Member (Browser)
  → AWS AppSync (GraphQL Mutation)
  → DynamoDB (CommunityChat table)
  → AppSync Subscription → All connected clients (real-time)

Admin (Browser)
  → Next.js Admin Panel (GitHub OAuth)
  → Lambda / DynamoDB (Inventory + Donations updates)
```

---

## Component Design

### 1. Ingestion Endpoint — Lambda Function URL

- Replaces AWS Pinpoint as the SMS/update ingestion point
- Public HTTPS endpoint — no API Gateway required
- Accepts JSON POST body: `{ phone, body }` where `body` is the SMS-format string
- Validates sender phone against the shelter registry in DynamoDB
- Parses the update body using the existing `Parser` module
- Writes `RECORD#CURRENT` and `LOG#<timestamp>` to the Shelters table
- Returns JSON confirmation or error response
- Rate limiting enforced via DynamoDB (`RATELIMIT#<hashedPhone>`)
- Environment variables: `SHELTER_TABLE`, `LOG_LEVEL`

> **Pinpoint note:** Pinpoint resources remain commented out in the CDK stack pending SMS sandbox approval. The Lambda Function URL provides equivalent ingest capability for demo and hackathon purposes.

### 2. Update_Processor — AWS Lambda (TypeScript)

- Runtime: Node.js 20.x, TypeScript compiled via esbuild
- Triggered by Lambda Function URL (HTTP POST) **and** SQS (for future Pinpoint re-enable)
- Responsibilities:
  - Validate sender phone number against the shelter registry
  - Parse update body using the `Parser` module
  - Write or update the `Capacity_Record` and `Needs_List` in DynamoDB
  - Write audit log entry with masked phone
  - Return structured JSON response (confirmation or error)
- IAM role: least-privilege, scoped to specific DynamoDB table ARN

### 3. Community Chat — AWS AppSync (GraphQL)

- GraphQL API with DynamoDB data source (`CommunityChat` table)
- Mutations: `sendMessage(roomId, senderName, message, userType)`
- Queries: `getMessages(roomId, limit)`
- Subscriptions: `onNewMessage(roomId)` — real-time push to all connected clients
- Auth: API key for public read; Cognito or IAM for write (configurable)
- Dashboard integrates AppSync JS client for subscription-based chat UI

### 4. Data_Store — AWS DynamoDB (Multi-Table)

Three tables (see `schema.md` for full attribute definitions):

| Table | PK | SK | Purpose |
|---|---|---|---|
| `shelterlink-shelters` | `SHELTER#<id>` | `RECORD#CURRENT` / `LOG#<ts>` | Shelter capacity, inventory, needs |
| `shelterlink-chat` | `ROOM#<roomId>` | `MSG#<timestamp>` | Community chat messages |
| `shelterlink-donations` | `USER#<userId>` | `DONATION#<donationId>` | User donation pledges |

- DynamoDB Streams enabled on `shelterlink-shelters` for SSE push to dashboard
- TTL on log entries: 90 days
- TTL on chat messages: 30 days

### 5. Dashboard — Next.js 14 (TypeScript)

- Pages:
  - `/` — public shelter list (SSR + SSE real-time updates)
  - `/shelter/[id]` — shelter detail with Needs_List, Inventory, and Community Chat
  - `/admin` — protected registry + inventory management (NextAuth.js session required)
  - `/donate/[shelterId]` — donation pledge form (public)
- Real-time shelter updates via SSE (`/api/updates`)
- Real-time chat via AppSync GraphQL subscription
- `USE_MOCK_DATA=true` bypasses all AWS calls for local development

---

## Data Flow

### Web Form / SMS Simulator Update

1. Operator submits form: `{ phone: "+15551234567", body: "BEDS 12/20 NEEDS blankets:high" }`
2. POST to Lambda Function URL
3. Lambda validates phone → looks up shelter in DynamoDB
4. Parser extracts `beds=12`, `capacity=20`, `needs=[{item:'blankets',priority:'HIGH'}]`
5. Lambda writes `RECORD#CURRENT` and `LOG#<timestamp>` to `shelterlink-shelters`
6. DynamoDB Stream triggers SSE push → connected Dashboard clients receive update
7. Lambda returns `{ ok: true, confirmation: "Updated: 12/20 beds. Needs: blankets (HIGH)." }`

### Community Chat Message

1. Community member types message in Dashboard chat panel
2. AppSync mutation `sendMessage` fires
3. AppSync writes to `shelterlink-chat` (`PK=ROOM#<shelterId>`, `SK=MSG#<timestamp>`)
4. AppSync subscription `onNewMessage` pushes to all connected clients in that room
5. Dashboard chat panel updates in real time

### Donation Pledge

1. Donor visits `/donate/<shelterId>` and submits pledge form
2. POST to `/api/donations` — writes to `shelterlink-donations` table
3. Admin panel shows pending pledges; admin marks as Delivered

### Dashboard Load

1. Browser requests `/` — Next.js SSR fetches all shelters from DynamoDB and renders HTML
2. Client hydrates and opens SSE connection to `/api/updates`
3. On DynamoDB Stream event, SSE endpoint pushes JSON patch to all connected clients
4. React state updates, shelter cards re-render without full reload

---

## Scalability

- Lambda Function URL scales automatically; no idle cost
- DynamoDB on-demand billing handles traffic spikes without pre-provisioning
- AppSync manages WebSocket connection state — no custom connection table needed for chat
- SSE connections remain stateless per Lambda invocation

---

## Security

### Input Validation
- All POST body content treated as untrusted input
- Parser uses strict regex; unmatched content rejected with error response
- DynamoDB writes use typed attribute schemas

### CSRF & Origin Protection
- Admin routes protected by NextAuth.js CSRF token validation
- API routes validate `Origin` header against `NEXT_PUBLIC_ALLOWED_ORIGIN`
- Lambda Function URL configured with CORS policy restricting allowed origins

### Authorization
- Shelter registry updates require authenticated admin session (GitHub OAuth)
- Lambda execution role uses least-privilege IAM — no `*` resource ARNs
- AppSync API key scoped to read-only; mutations require authenticated identity

### Data Privacy
- Phone numbers stored in DynamoDB are hashed (SHA-256 + salt) in audit log entries
- Live registry stores E.164 format numbers; access restricted to Lambda role only
- Phone numbers never appear in plaintext in CloudWatch logs (`maskPhone()`)

---

## Region Configuration

All AWS SDK clients **must** initialize with an explicit region:

```typescript
new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })
```

This prevents silent region fallback to an incorrect default when `AWS_REGION` is not set in the Lambda execution environment.

---

## AWS Well-Architected Alignment

| Pillar | Implementation |
|---|---|
| Operational Excellence | CloudWatch alarms on Lambda errors and DynamoDB throttles; structured JSON logging |
| Security | Least-privilege IAM, input validation, CSRF protection, phone number masking in logs |
| Reliability | DynamoDB on-demand, Lambda retries on SQS, SSR fallback for Dashboard |
| Performance Efficiency | Single-table DynamoDB design, SSE over polling, AppSync subscriptions for chat |
| Cost Optimization | Serverless pay-per-use, DynamoDB TTL on logs and chat, no idle EC2 |
| Sustainability | No always-on compute; Lambda cold starts acceptable for update latency budget |
