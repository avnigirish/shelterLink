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
| **Pledge donation (agentic)** | `shelterlink-donations` DynamoDB write | Execute via `PledgeTool` — no UI navigation required |
| **Alert shelter staff (agentic)** | `shelterlink-chat` DynamoDB write | Execute via `AlertTool` — posts coordination message to shelter room |

---

### Agentic Tool Definitions

The Advocate operates as an agent with two callable tools. When the model determines a user wants to take action (not just get information), it invokes the appropriate tool rather than returning a text suggestion.

#### `PledgeTool`

Writes a donation pledge directly to DynamoDB on behalf of the user. Eliminates the need to navigate to `/donate/<shelterId>`.

```typescript
// Tool definition passed to Bedrock Converse API
{
  name: 'PledgeTool',
  description: 'Create a donation pledge for a specific shelter and item. Use this when the user expresses intent to donate a specific item (e.g., "I want to donate coats", "Help me donate these blankets").',
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        shelterId:   { type: 'string', description: 'The shelter ID to pledge to' },
        item:        { type: 'string', description: 'The item being donated (e.g., "winter coats", "blankets")' },
        quantity:    { type: 'number', description: 'Estimated quantity (default 1 if not specified)' },
        donorName:   { type: 'string', description: 'Donor name or "Anonymous" if not provided' },
      },
      required: ['shelterId', 'item'],
    },
  },
}
```

**Execution:** The API route intercepts the tool call, writes to `shelterlink-donations` (`PK=USER#anonymous`, `SK=DONATION#<uuid>`), then feeds the result back to the model to generate a confirmation message.

#### `AlertTool`

Posts a coordination message to a shelter's Community Chat room. Used when the user wants to notify shelter staff or coordinate with other volunteers.

```typescript
{
  name: 'AlertTool',
  description: 'Post a coordination message to a shelter\'s community chat. Use this when the user wants to alert shelter staff or coordinate with other volunteers (e.g., "Let them know I\'m coming", "Tell the shelter I have supplies").',
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        shelterId: { type: 'string', description: 'The shelter ID to post to' },
        message:   { type: 'string', description: 'The coordination message to post' },
      },
      required: ['shelterId', 'message'],
    },
  },
}
```

**Execution:** Writes to `shelterlink-chat` (`PK=ROOM#<shelterId>`, `SK=MSG#<timestamp>`) with `senderName="Community Advocate"` and `userType="advocate"`. AppSync subscriptions push the message to all connected clients in that room in real time.

---

### Agentic API Route — Updated Flow

The `/api/advocate` route switches from `InvokeModelWithResponseStream` to the **Bedrock Converse API** (`ConverseCommand`) to support tool use. The agentic loop:

```
1. User: "Help me donate these coats"
2. POST /api/advocate → build system prompt + tool definitions
3. Bedrock Converse → model returns toolUse block: PledgeTool({ shelterId, item: "coats", quantity: 1 })
4. API route executes PledgeTool → writes pledge to DynamoDB
5. Feed tool result back to Bedrock: { pledgeId, shelter, item, status: "confirmed" }
6. Bedrock generates final confirmation message
7. Stream confirmation to browser
```

The model decides autonomously whether to call a tool or respond with text. Tool calls are transparent to the user — the chat shows a brief "Taking action…" indicator while the tool executes, then the model's confirmation message.

### CDK Changes Required

```typescript
// IAM: Bedrock Converse + tool execution permissions
new iam.PolicyStatement({
  actions: [
    'bedrock:InvokeModel',
    'bedrock:InvokeModelWithResponseStream',
    'bedrock:Converse',
  ],
  resources: ['*'],
})

// IAM: DynamoDB write for PledgeTool and AlertTool
new iam.PolicyStatement({
  actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
  resources: [
    donationsTable.tableArn,
    chatTable.tableArn,
  ],
})
```

Environment variable added to dashboard: `BEDROCK_REGION=us-east-1`

### Data Flow — Agentic Pledge

1. User types "Help me donate these coats"
2. `AdvocateChat` POSTs to `/api/advocate` with `{ message, context: 'home' }`
3. API route fetches shelters, builds system prompt + tool definitions
4. Calls Bedrock `ConverseCommand` — model identifies donation intent
5. Model returns `toolUse: PledgeTool({ shelterId: "central-union-dc", item: "coats", quantity: 1 })`
6. API route writes pledge to `shelterlink-donations` DynamoDB table
7. Feeds `toolResult` back to Bedrock with pledge confirmation
8. Model generates: "Done — I've pledged your coats to Central Union Mission in DC. They have winter coats listed as CRITICAL right now. Check the community chat for drop-off timing."
9. Response streamed to browser

### Data Flow — Agentic Alert

1. User types "Tell the shelter I'm bringing supplies tomorrow morning"
2. Model returns `toolUse: AlertTool({ shelterId: "...", message: "Volunteer incoming with supplies tomorrow morning" })`
3. API route writes to `shelterlink-chat` — AppSync pushes to all connected clients
4. Model confirms: "Done — I've posted a message to the shelter's community chat. Staff and other volunteers will see it in real time."

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
