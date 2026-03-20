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

---

## AI Community Advocate — Agent Design

### Overview

The AI Community Advocate is a conversational assistant embedded in the ShelterLink dashboard. It uses Amazon Bedrock (Claude 3.5 Sonnet) to generate empathetic, action-oriented responses grounded in live shelter data from DynamoDB. It is not a general-purpose chatbot — every response is anchored to real shelter state.

```
Browser (AdvocateChat component)
  → POST /api/advocate  (Next.js API route)
  → Lambda advocate-handler  (Bedrock + DynamoDB)
  → Amazon Bedrock — Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)
  → Structured JSON response → Browser
```

### Frontend Component — `AdvocateChat.tsx`

- `'use client'` component, rendered on shelter detail pages and the home page
- Floating chat bubble (bottom-right) — expands to a panel on click
- Sends `POST /api/advocate` with `{ message: string, shelterId?: string, context: 'home' | 'shelter' }`
- Streams response tokens via the Vercel AI SDK `useChat` hook (or plain `fetch` with `ReadableStream`)
- Displays typing indicator while awaiting response
- Starter prompts shown on first open:
  - "I have blankets to donate — where should I go?"
  - "What does this shelter need most right now?"
  - "How can I help as a first-time volunteer?"

### API Route — `POST /api/advocate`

- Next.js App Router route handler (`src/app/api/advocate/route.ts`)
- Accepts: `{ message: string, shelterId?: string, context: 'home' | 'shelter' }`
- Steps:
  1. Fetch relevant shelter data from DynamoDB (all shelters for `home` context; specific shelter for `shelter` context)
  2. Build a structured system prompt (see below)
  3. Call Bedrock `InvokeModelWithResponseStream` with Claude 3.5 Sonnet
  4. Stream response back to client as `text/event-stream`
- Auth: public (no session required) — rate-limited by IP via a lightweight DynamoDB counter
- Error handling: returns a graceful fallback message if Bedrock is unavailable

### Lambda — `advocate-handler` (optional dedicated function)

For production, the Bedrock call can be extracted to a dedicated Lambda to keep the Next.js server lean. For hackathon scope, the API route handles it directly.

### System Prompt Design

The system prompt is assembled dynamically from live DynamoDB data:

```
You are the ShelterLink Community Advocate — an empathetic, grounded, and action-oriented assistant helping volunteers and donors make the most impact.

Your mission: connect people with shelters that need them most, right now.

CURRENT SHELTER DATA (as of <timestamp>):
<shelter name> — <state> — <status> — <beds> beds available
  Critical needs: <items>
  High needs: <items>
  Inventory: <items>

CAPABILITIES:
1. Suggest the best shelter(s) for a specific donation item
2. Summarize recent community chat activity for a shelter
3. Guide new users through how ShelterLink works and the Build for Impact mission
4. Explain what "critical" vs "high" priority needs mean in practice

TONE: Empathetic, grounded, and action-oriented. Never vague. Always end with a specific next step.
CONSTRAINTS: Only reference shelters in the data above. Never fabricate bed counts or needs.
```

### Agent Capabilities

| Capability | Data Source | Bedrock Role |
|---|---|---|
| Shelter matching by donation item | DynamoDB `needsList` scan | Rank and explain best matches |
| Community chat summary | DynamoDB `shelterlink-chat` (last 20 msgs) | Summarize activity, surface coordination needs |
| New user onboarding | Static mission copy | Explain Build for Impact, walk through steps |
| Critical needs explanation | `needsList` priorities | Contextualize urgency in human terms |

### CDK Changes Required

```typescript
// New Bedrock IAM permission on the advocate Lambda/Next.js role
new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
  resources: ['arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0'],
})
```

Environment variable added to dashboard: `BEDROCK_REGION=us-east-1`

### Data Flow

1. User types "I have winter coats — which shelter needs them most?"
2. `AdvocateChat` POSTs to `/api/advocate` with `{ message, context: 'home' }`
3. API route fetches all shelters from DynamoDB, filters for `OPEN` status and `winter coats` in needsList
4. Builds system prompt with live shelter data injected
5. Calls `bedrock:InvokeModelWithResponseStream` — Claude 3.5 Sonnet
6. Streams tokens back to browser; component renders incrementally
7. Response: "Central Union Mission in DC has winter coats listed as CRITICAL right now — they have 25 beds open and are actively accepting donations. Head to their detail page to pledge or check the community chat for drop-off coordination."

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
