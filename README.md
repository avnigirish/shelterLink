# ShelterLink

> Real-time shelter capacity tracking and community coordination — built for the AWS Reachback Hackathon.
> Theme: *Build for Impact — Code That Matters to Your Community*

---

## What It Does

ShelterLink lets non-technical shelter staff submit capacity updates via a web form or SMS simulator. Those updates appear instantly on a public-facing dashboard that any volunteer or donor can access — no account, no app, no friction. Community members can chat in real time per shelter, and donors can pledge supplies and track delivery.

**The critical path:**

```
Web Form / SMS Simulator
  → Lambda Function URL (Update_Processor)
  → DynamoDB shelterlink-data (RECORD#CURRENT + LOG#<ts>)
  → DynamoDB Stream → Stream Handler Lambda
  → SSE /api/updates → Next.js Dashboard
  → Volunteer / Donor (Browser)

Community Member (Browser)
  → POST /api/chat/[shelterId] → DynamoDB shelterlink-chat
  → AppSync Subscription onNewMessage → All connected clients

Volunteer / Donor (Browser)
  → POST /api/advocate → Amazon Bedrock (Nova Pro)
  → PledgeTool → shelterlink-donations
  → AlertTool  → shelterlink-chat + AppSync push
```

> **Pinpoint note:** AWS Pinpoint SMS requires sandbox approval on new accounts. Pinpoint resources are commented out in the CDK stack with `TODO` markers. The Lambda Function URL provides equivalent ingest capability for demo purposes. To re-enable: request SMS sandbox access in the AWS Console, then uncomment the Pinpoint block in `packages/infra/lib/shelter-link-stack.ts`.

---

## AI Community Advocate

ShelterLink includes an AI-powered Community Advocate built on Amazon Bedrock (Amazon Nova Pro). It's a conversational assistant embedded in the dashboard that helps volunteers and donors take immediate, high-impact action.

**What it does:**
- Matches your donation items to shelters with those items listed as CRITICAL or HIGH priority needs — using live DynamoDB data
- Summarizes what's happening at a specific shelter based on its current needs and inventory
- Guides new users through the Build for Impact mission and the ShelterLink workflow

**Tone:** Empathetic, grounded, and action-oriented. Every response ends with a specific next step. Responses render with full markdown formatting (bold, lists, etc.).

**Architecture:**
```
Browser (AdvocateChat component)
  → POST /api/advocate  { message, shelterId?, context, history[] }
  → Fetch live shelter data from DynamoDB (or mock store)
  → Build system prompt with shelter context
  → Bedrock ConverseCommand (agentic loop, max 3 iterations)
  → Tool execution: PledgeTool → DynamoDB, AlertTool → chat
  → Return { text: string, toolUsed?: string } → Browser
```

**Example interaction:**
> User: "I have winter coats — where should I go?"
>
> Advocate: "Winter coats are critically needed right now. Central Union Mission in DC has them listed as CRITICAL with 25 beds open — they're actively accepting donations today. Head to their shelter page to pledge your coats and check the community chat for drop-off timing."

**Setup:**
1. Set `BEDROCK_REGION=us-east-1` in `packages/dashboard/.env.local`
2. Attach an IAM policy to your user/role with `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`, and `bedrock:Converse` on `"Resource": "*"`
3. Enable Amazon Nova Pro in the Bedrock console under Model access (no use case form required)

> **Model note:** Amazon Nova Pro (`amazon.nova-pro-v1:0`) requires no Anthropic use case approval and is available immediately in new AWS accounts. Claude models require submitting an Anthropic use case form before first use.

---

## Agentic AI — Reducing Time-to-Impact

### The Shift: From Search-Based UI to Action-Based AI

Traditional donation platforms require donors to navigate a multi-step funnel: browse shelters → find a match → open a form → fill it out → submit. Every step is friction. Every step loses people.

ShelterLink's Agentic AI Advocate collapses that funnel to a single natural language message.

> "Help me donate these coats" → pledge created, shelter notified, donor confirmed — in one turn.

This is the core 2026 Agentic AI pattern: **the model doesn't just answer questions, it takes actions**.

### How It Works

The Advocate uses the **Bedrock Converse API** with two callable tools:

| Tool | What it does | When the model uses it |
|---|---|---|
| `PledgeTool` | Writes a donation pledge to DynamoDB | User expresses donation intent |
| `AlertTool` | Posts a coordination message to shelter's Community Chat | User wants to notify staff or volunteers |

The agentic loop:
```
User message + conversation history (last 10 turns)
  → Bedrock ConverseCommand (with tool definitions, max 3 iterations)
  → Model decides: answer with text OR call a tool
  → If tool: API route executes it (DynamoDB write)
  → Tool result fed back to model as toolResult content block
  → Model generates confirmation message
  → Strip any <thinking> blocks from output
  → Return { text, toolUsed? } to browser
```

The model decides autonomously whether to call a tool. No routing logic, no intent classifiers — the model reads the user's message and acts.

### Time-to-Impact Comparison

| Workflow | Steps | Time |
|---|---|---|
| Traditional UI | Browse → Filter → Open shelter → Find form → Fill out → Submit | ~4–6 minutes |
| Agentic Advocate | Type one message → Done | ~15 seconds |

### Process Transparency

The chat shows a "Taking action…" indicator while tools execute, so users always know when the Advocate is doing something vs. just responding. Every tool action is confirmed in the model's reply with specifics: what was pledged, to which shelter, what happens next.

This transparency is intentional — agentic systems that act silently erode trust. The Advocate shows its work.

---

## Community Activity Feed

When the Advocate agent processes a donation pledge, it automatically posts a notification to the shelter's community chat — so everyone watching the feed sees generosity happen in real time, without any manual action.

**How it works:**

1. A user tells the Advocate they want to donate (e.g. "I have 10 blankets for shelter-001")
2. The Advocate calls `PledgeTool` → pledge written to DynamoDB (or mock store)
3. `PledgeTool` immediately calls `AlertTool` with a formatted message: `🤝 Alice has pledged to donate 10× blankets`
4. `AlertTool` pushes a `ChatMessage` to `MOCK_MESSAGES` (mock mode) or DynamoDB `shelterlink-chat` (prod)
5. The `CommunityChat` component picks it up on its next 3-second poll

**Visual treatment:** Pledge notifications render with a teal background and teal text — no role badge — so they stand out from regular volunteer/donor messages at a glance.

**Fallback behavior:** If the `AlertTool` call fails, the pledge still succeeds. The notification is non-fatal and wrapped in a `try/catch` inside `executePledgeTool`.

**Mock community members:** `mockUsers.ts` holds 8 realistic community profiles (`VOLUNTEER`, `DONOR`, `STAFF`) linked to matching records in `mockDonations.ts`. Every `donationId` in a user's profile corresponds to a real `DonationRecord`, and every `DonationRecord.userId` maps back to a `MockUser` — referential integrity is verified by property-based tests.

**Admin community view:** The `/admin` page includes a "Community Members" table showing each user's name, email, role badge, activity summary, and join date. Empty state renders "No community members yet" when the list is empty.

---

## New Features

| Feature | Description |
|---|---|
| Lambda Function URL | Public HTTPS endpoint for update ingestion — replaces Pinpoint for demo/hackathon |
| Real-Time Dashboard | SSE-powered shelter list updates within 5 seconds of any capacity change |
| Prioritized Needs List | Per-shelter needs ranked CRITICAL → HIGH → MEDIUM → LOW, filterable without page reload |
| Inventory Management | Shelter staff track current supply quantities via admin panel; atomic DynamoDB `UpdateItem` |
| Community Chat | Real-time per-shelter chat via AWS AppSync GraphQL subscriptions |
| Donation Tracking | Donors pledge supplies; admins mark pledges as delivered; full status history |
| AI Community Advocate | Bedrock-powered agentic assistant — matches donors to shelters, executes pledges and chat alerts via tools |
| Community Activity Feed | Pledge notifications auto-posted to shelter chat by the Advocate agent |
| Admin Panel | GitHub OAuth-gated registry management, inventory editing, and donation oversight |

---

## Project Structure

```
shelterlink/
├── packages/
│   ├── lambda/          # Update_Processor — TypeScript, Node.js 20.x
│   │   └── src/
│   │       ├── handler.ts          # Lambda Function URL + SQS handler
│   │       ├── parser.ts           # SMS-format body parser
│   │       ├── prettyPrinter.ts    # Confirmation message formatter
│   │       ├── registry.ts         # Phone → shelter lookup + maskPhone()
│   │       ├── rateLimit.ts        # Unauthorized attempt suppression
│   │       ├── streamHandler.ts    # DynamoDB Streams → SSE push
│   │       └── types.ts            # Shared Lambda types
│   ├── dashboard/       # Next.js 14 App Router, Tailwind CSS
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx                    # SSR home — shelter list
│   │       │   ├── shelter/[id]/page.tsx        # SSR detail — needs, inventory, chat
│   │       │   ├── donate/[shelterId]/page.tsx  # Donation pledge form
│   │       │   ├── login/page.tsx               # GitHub OAuth login
│   │       │   └── admin/page.tsx               # Admin — registry + inventory
│   │       ├── components/
│   │       │   ├── ShelterList.tsx
│   │       │   ├── NeedsFilter.tsx
│   │       │   ├── CommunityChat.tsx            # AppSync subscription chat
│   │       │   ├── InventoryPanel.tsx           # Inventory display + admin edit
│   │       │   ├── DonationForm.tsx             # Pledge form
│   │       │   └── AddShelterForm.tsx
│   │       └── lib/
│   │           ├── db.ts           # DynamoDB data-access
│   │           ├── auth.ts         # NextAuth config
│   │           ├── registry.ts     # Shelter registry CRUD
│   │           └── mockData.ts     # Local dev mock data (Springfield, IL)
│   └── infra/           # AWS CDK v2 stack
│       └── lib/
│           └── shelter-link-stack.ts
├── .kiro/
│   └── specs/
│       └── shelter-link/
│           ├── requirements.md
│           ├── system_design.md
│           ├── schema.md           # DynamoDB table schemas
│           └── tasks.md
└── README.md
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Run the dashboard locally with mock data (no AWS needed)
cd packages/dashboard && npm run dev

# Run all tests
npm run test --workspaces
```

### Local dev with mock data

The dashboard defaults to mock data (real Springfield, IL shelters) when `USE_MOCK_DATA=true` is set in `packages/dashboard/.env.local`. No AWS credentials required.

```bash
# packages/dashboard/.env.local
AWS_REGION=us-east-1
USE_MOCK_DATA=true
```

### Deploy to AWS

```bash
# First-time bootstrap
cd packages/infra && npx cdk bootstrap

# Deploy
npx cdk deploy

# Once deployed, switch dashboard to real data
# packages/dashboard/.env.local
SHELTER_TABLE=shelterlink-data
AWS_REGION=us-east-1
NEXT_PUBLIC_APPSYNC_ENDPOINT=https://<id>.appsync-api.us-east-1.amazonaws.com/graphql
NEXT_PUBLIC_APPSYNC_API_KEY=<key>
```

---

## Environment Variables

Create `packages/dashboard/.env.local` before running locally:

```bash
# Local dev (mock data — no AWS needed)
AWS_REGION=us-east-1
USE_MOCK_DATA=true

# Production (real DynamoDB + AppSync)
AWS_REGION=us-east-1
SHELTER_TABLE=shelterlink-shelters
CHAT_TABLE=shelterlink-chat
DONATIONS_TABLE=shelterlink-donations
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
NEXT_PUBLIC_APPSYNC_ENDPOINT=
NEXT_PUBLIC_APPSYNC_API_KEY=

# Admin auth
NEXT_PUBLIC_ALLOWED_ORIGIN=https://your-domain.com
NEXTAUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=https://your-domain.com
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ALLOWED_EMAILS=           # comma-separated allowed GitHub emails

# AI Community Advocate
BEDROCK_REGION=us-east-1  # must have bedrock:InvokeModel and bedrock:Converse on amazon.nova-pro-v1:0
```

Lambda environment variables are set automatically by the CDK stack.

---

## Technical Write-Up: Learning with Kiro and Spec-Driven Development

### The Problem with Vibe Coding Alone

When I started ShelterLink, my instinct was to jump straight into code — scaffold a Next.js app, wire up a Lambda, figure out the rest as I went. That works fine for personal projects, but for a hackathon submission that needs to demonstrate real architectural thinking, it produces something that *runs* but doesn't *explain itself*.

The bigger issue: every time I asked Kiro to generate something, I got generic output. A Lambda handler that used `console.log`. A DynamoDB schema that used `aws-sdk` v2. A React component that polled an endpoint every second. Technically functional, but not what I wanted — and not what the hackathon rubric was looking for.

The fix wasn't to write better prompts. It was to write better *context*.

---

### What Steering Docs Actually Do

Kiro's steering files (`.kiro/steering/*.md`) are persistent context that gets injected into every interaction. Think of them as a standing brief you'd give a new engineer on day one: here's our stack, here's what we don't do, here's why.

Before I added `steering.md`, a typical Kiro response for a Lambda handler looked like this:

```javascript
// Before steering
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));
  // TODO: parse SMS body
};
```

After adding explicit rules — TypeScript only, AWS SDK v3, structured logging via Powertools, explicit region, no TODOs — the same request produced:

```typescript
// After steering
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const logger = new Logger({ serviceName: 'update-processor' });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })
);

export const handler = async (event: unknown): Promise<void> => {
  // implementation follows...
};
```

Same prompt. Completely different output. The steering doc did the work.

---

### The Spec-Driven Development Loop

The workflow I landed on has three phases that feed each other:

**1. Requirements first, code second**

Writing `requirements.md` before touching a keyboard forced me to answer questions I would have deferred: What does "real-time" actually mean? (Within 5 seconds of update receipt.) What happens when an unauthorized number submits? (Suppress after 5 attempts.) What's the update format? (Case-insensitive, whitespace-tolerant.)

These aren't implementation details — they're correctness properties. And once they're written down, Kiro can check against them.

**2. Design as a contract**

`system_design.md` isn't documentation I wrote after the fact. It's a contract I wrote *before* asking Kiro to generate anything. When the design says "multi-table DynamoDB with `PK`/`SK` composite keys," every generated schema respects that. When it says "SSE over polling," no generated component opens a `setInterval`. When it says "AppSync for chat," no component opens a WebSocket manually.

**3. Steering as a style guide**

The steering rules I found most valuable weren't the obvious ones ("use TypeScript"). They were the ones that encoded *why*:

- "Always include `region: process.env['AWS_REGION'] ?? 'us-east-1'` in SDK clients" — because silent region fallback caused real deployment failures.
- "No `console.log` in Lambda handlers — use structured logging with `@aws-lambda-powertools/logger`" — because CloudWatch log insights requires structured JSON to be queryable.
- "Phone numbers must never appear in plaintext in CloudWatch logs" — because audit logs are often accessible to more people than the application itself.

When the *why* is in the steering doc, Kiro doesn't just follow the rule — it applies the same reasoning to adjacent decisions I didn't explicitly cover.

---

### Pivoting Under Pressure

Mid-project, AWS Pinpoint hit a `SubscriptionRequiredException` wall — new accounts require manual sandbox approval with a multi-day lead time. Rather than block on that, the architecture pivoted:

- **Pinpoint → Lambda Function URL**: A public HTTPS endpoint that accepts the same SMS-format body as a JSON POST. The parser, registry, and rate-limit logic are unchanged. The only difference is the event envelope.
- **Added AppSync**: Community Chat needed real-time bidirectional messaging — SSE is one-way. AppSync GraphQL subscriptions handle this cleanly without a custom WebSocket server.
- **Added Inventory + Donations**: The DynamoDB schema expanded from single-table to three tables. The `inventory` field on the Shelter record uses a DynamoDB Map attribute — atomic `UpdateItem` operations keep it consistent.

The pivot took less than a day because the spec documents absorbed the change cleanly. Requirements updated, design updated, tasks updated — the code followed the spec, not the other way around.

---

### What Changed in Practice

| Without Steering | With Steering |
|---|---|
| `aws-sdk` v2 imports | AWS SDK v3 modular imports |
| `console.log` debugging | `@aws-lambda-powertools/logger` structured logs |
| Hardcoded table names | Environment variable reads |
| Polling-based dashboard updates | SSE via DynamoDB Streams |
| No explicit region | `region: process.env['AWS_REGION'] ?? 'us-east-1'` everywhere |
| Generic color palette | WCAG 2.1 AA contrast-checked Tailwind tokens |
| No test coverage | Vitest unit tests + property-based round-trip tests |
| `any` types throughout | Explicit types with `unknown` + type guards |
| Streaming-only AI responses | Agentic loop with tool execution + conversation history |

---

## Known Constraints & Design Decisions

### Pinpoint SMS (temporarily disabled)
AWS Pinpoint requires a subscription approval on new accounts (`SubscriptionRequiredException`). The Pinpoint resources in the CDK stack are commented out with a `TODO` marker. To re-enable:
1. Go to AWS Console → Amazon Pinpoint → request SMS sandbox access
2. Uncomment the Pinpoint block in `packages/infra/lib/shelter-link-stack.ts`
3. Redeploy with `npx cdk deploy`

### Lambda Function URL (current ingestion)
The Lambda Function URL is the active ingestion endpoint. It accepts `POST { phone, body }` and returns `{ ok, confirmation }` or `{ ok, error }`. CORS is configured to restrict allowed origins.

### Auth Provider
Admin routes use **GitHub OAuth via NextAuth.js** (not AWS Cognito). Cognito adds CDK complexity that isn't justified for hackathon scope.

### AppSync for Chat
AppSync manages WebSocket connection state for Community Chat — no custom connection table needed. The DynamoDB `shelterlink-chat` table is the AppSync data source.

### SSE Reconnection
SSE connections are stateless per Lambda invocation. The client dashboard implements exponential backoff reconnection (max 30s interval).

### Region Configuration
All AWS SDK clients explicitly set `region: process.env['AWS_REGION'] ?? 'us-east-1'`. This prevents silent region fallback failures in Lambda and Next.js server components.

---

## AWS Services Used

| Service | Role |
|---|---|
| AWS Lambda (Function URL) | Update ingestion endpoint — replaces Pinpoint for demo |
| AWS Lambda (SQS trigger) | Update_Processor — parse, validate, write |
| AWS DynamoDB | Multi-table data store — shelters, chat, donations |
| AWS AppSync | GraphQL API — real-time Community Chat subscriptions |
| Amazon Bedrock (Amazon Nova Pro) | AI Community Advocate — shelter matching, needs summarization, onboarding |
| AWS SNS | Event bridge (retained for future Pinpoint re-enable) |
| AWS SQS + DLQ | Reliable message delivery with failure capture |
| AWS CDK | Infrastructure as code |
| AWS CloudWatch | Structured logging and alarms |
| AWS Pinpoint | SMS gateway — commented out pending sandbox approval |

---

## License

MIT
