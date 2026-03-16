# ShelterLink

> Real-time shelter capacity tracking via SMS — built for the AWS Reachback Hackathon.
> Theme: *Build for Impact — Code That Matters to Your Community*

---

## What It Does

ShelterLink lets non-technical shelter staff send a plain SMS to update their shelter's bed availability and supply needs. Those updates appear instantly on a public-facing dashboard that any volunteer or donor can access — no account, no app, no friction.

**The critical path:**

```
Shelter Manager (SMS)
  → AWS Pinpoint
  → AWS Lambda (Update_Processor)
  → AWS DynamoDB
  → Next.js Dashboard (SSE)
  → Volunteer / Donor (Browser)
```

---

## Project Structure

```
shelterlink/
├── packages/
│   ├── lambda/          # Update_Processor — TypeScript, Node.js 20.x
│   │   ├── src/
│   │   │   ├── handler.ts
│   │   │   ├── parser.ts
│   │   │   ├── prettyPrinter.ts
│   │   │   ├── registry.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── types.ts
│   │   └── vitest.config.ts
│   ├── dashboard/       # Next.js 14 App Router, Tailwind CSS
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx              # SSR home — shelter list
│   │   │   │   └── shelter/[id]/page.tsx # SSR detail — needs list
│   │   │   ├── lib/
│   │   │   │   ├── db.ts                 # DynamoDB data-access layer
│   │   │   │   └── mockData.ts           # Real shelter data for local dev
│   │   │   └── types/
│   │   │       └── shelter.ts            # Shared TypeScript types
│   │   └── tailwind.config.ts            # WCAG 2.1 AA color tokens
│   └── infra/           # AWS CDK stack (TypeScript)
│       └── lib/
│           └── shelter-link-stack.ts
├── .kiro/
│   └── specs/
│       └── shelter-link/
│           ├── requirements.md
│           ├── system_design.md
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

> **Note:** AWS Pinpoint requires a separate subscription approval before the full stack can deploy. See [Known Constraints](#known-constraints--design-decisions) below.

```bash
# First-time bootstrap
cd packages/infra && npx cdk bootstrap

# Deploy (Pinpoint is commented out until subscription is approved)
npx cdk deploy

# Once deployed, switch dashboard to real data
# packages/dashboard/.env.local
SHELTER_TABLE=shelterlink-data
AWS_REGION=us-east-1
```

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

After adding explicit rules — TypeScript only, AWS SDK v3, structured logging via Powertools, no TODOs — the same request produced:

```typescript
// After steering
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { SNSEvent } from 'aws-lambda';

const logger = new Logger({ serviceName: 'update-processor' });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: SNSEvent): Promise<void> => {
  // implementation follows...
};
```

Same prompt. Completely different output. The steering doc did the work.

---

### The Spec-Driven Development Loop

The workflow I landed on has three phases that feed each other:

**1. Requirements first, code second**

Writing `requirements.md` before touching a keyboard forced me to answer questions I would have deferred: What does "real-time" actually mean? (Within 5 seconds of SMS receipt.) What happens when an unauthorized number texts in? (Reply once, then suppress after 5 attempts.) What's the SMS format? (Case-insensitive, whitespace-tolerant.)

These aren't implementation details — they're correctness properties. And once they're written down, Kiro can check against them.

**2. Design as a contract**

`system_design.md` isn't documentation I wrote after the fact. It's a contract I wrote *before* asking Kiro to generate anything. When the design says "single-table DynamoDB with `PK`/`SK` composite keys," every generated schema respects that. When it says "SSE over polling," no generated component opens a `setInterval`.

The design doc also forced me to think about the seams between components — specifically, the Parser/Pretty_Printer round-trip. That invariant (parse → format → parse = same record) became a property-based test, which became a real correctness guarantee.

**3. Steering as a style guide**

The steering rules I found most valuable weren't the obvious ones ("use TypeScript"). They were the ones that encoded *why*:

- "No `console.log` in Lambda handlers — use structured logging with `@aws-lambda-powertools/logger`" — because CloudWatch log insights requires structured JSON to be queryable.
- "Phone numbers must never appear in plaintext in CloudWatch logs" — because audit logs are often accessible to more people than the application itself.
- "Use `aria-live=\"polite\"` for real-time update regions" — because screen reader users need to know when shelter data changes without losing their place on the page.

When the *why* is in the steering doc, Kiro doesn't just follow the rule — it applies the same reasoning to adjacent decisions I didn't explicitly cover.

---

### What Changed in Practice

| Without Steering | With Steering |
|---|---|
| `aws-sdk` v2 imports | AWS SDK v3 modular imports |
| `console.log` debugging | `@aws-lambda-powertools/logger` structured logs |
| Hardcoded table names | Environment variable reads |
| Polling-based dashboard updates | SSE via DynamoDB Streams |
| Generic color palette | WCAG 2.1 AA contrast-checked Tailwind tokens |
| No test coverage | Vitest unit tests + property-based round-trip tests |
| `any` types throughout | Explicit types with `unknown` + type guards |

The steering doc didn't make Kiro smarter. It made the *context* smarter — and that's the same thing in practice.

---

### Key Takeaway

Spec-Driven Development with Kiro isn't about writing more documentation. It's about writing the *right* documentation *first*, so that every code generation request starts from a shared understanding of what correct looks like.

The three artifacts — `requirements.md`, `system_design.md`, `steering.md` — aren't overhead. They're the difference between a prototype that demos well and a system you'd actually hand to a shelter manager at 2am during a crisis.

---

## Environment Variables

Create `packages/dashboard/.env.local` before running locally:

```bash
# Local dev (mock data — no AWS needed)
AWS_REGION=us-east-1
USE_MOCK_DATA=true

# Production (real DynamoDB)
AWS_REGION=us-east-1
SHELTER_TABLE=shelterlink-data
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Admin auth (Phase 6)
NEXT_PUBLIC_ALLOWED_ORIGIN=https://your-domain.com
NEXTAUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=https://your-domain.com
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Lambda environment variables are set automatically by the CDK stack via `environment:` on the function definition.

---

## Known Constraints & Design Decisions

### Pinpoint SMS (temporarily disabled)
AWS Pinpoint requires a subscription approval on new accounts (`SubscriptionRequiredException`). The Pinpoint resources in the CDK stack are commented out with a `TODO` marker. To re-enable:
1. Go to AWS Console → Amazon Pinpoint → request SMS sandbox access
2. Uncomment the Pinpoint block in `packages/infra/lib/shelter-link-stack.ts`
3. Redeploy with `npx cdk deploy`

### Auth Provider
Admin routes use **GitHub OAuth via NextAuth.js** (not AWS Cognito). Cognito adds CDK complexity that isn't justified for hackathon scope. Swap to Cognito post-launch if multi-org admin access is needed.

### SSE Reconnection
SSE connections are stateless per Lambda invocation. The client dashboard implements exponential backoff reconnection (max 30s interval). Connection state is tracked in a DynamoDB `CONNECTIONS` table (`PK=CONN#<connectionId>`, TTL=300s).

### SMS Throughput & Rate Limiting
Lambda reserved concurrency is set to 10 for the Update_Processor to prevent DynamoDB write throttling during traffic spikes. An SQS queue with a Dead Letter Queue (DLQ) sits between SNS and Lambda — failed SMS processing is captured rather than silently dropped.

### Pinpoint Number Type
Uses a **long code** number for development and demo. Toll-free numbers require carrier registration (2–3 week lead time). Switch to toll-free for production to improve deliverability.

### Audit Hook Scope
The React Quality & Accessibility audit hook fires on `.tsx` and `.jsx` files only. Lambda TypeScript handlers (`.ts`) are covered by the Vitest test suite and CDK synth checks instead.

---

## AWS Services Used

| Service | Role |
|---|---|
| AWS Pinpoint | SMS gateway — inbound and outbound |
| AWS Lambda | Update_Processor — parse, validate, write |
| AWS DynamoDB | Data_Store — single-table, on-demand |
| AWS SNS | Event bridge between Pinpoint and Lambda |
| AWS CDK | Infrastructure as code |
| AWS CloudWatch | Structured logging and alarms |

---

## License

MIT
