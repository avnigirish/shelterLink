# Tech Stack

## Languages & Runtimes
- TypeScript throughout — all packages use strict TypeScript (no `any`, use `unknown` + type guards)
- Node.js 20.x

## Packages

### `packages/lambda` — Update_Processor
- Runtime: AWS Lambda (Node.js 20.x)
- AWS SDK v3: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
- Structured logging: `@aws-lambda-powertools/logger` — never use `console.log` in Lambda handlers
- Bundler: esbuild (`esbuild.config.mjs`)
- Tests: Vitest + `fast-check` for property-based testing

### `packages/dashboard` — Next.js Frontend
- Next.js 14 App Router (no Pages Router)
- React 18, Tailwind CSS 3
- Auth: NextAuth.js v4 with GitHub OAuth provider
- AWS SDK v3 for DynamoDB access
- AWS AppSync JS client (`aws-amplify` or `@aws-amplify/api`) for Community Chat subscriptions
- Tests: Vitest + `@testing-library/react`

### `packages/infra` — CDK Infrastructure
- AWS CDK v2 (TypeScript)
- Tests: Jest + `ts-jest`

## Key Conventions
- AWS SDK v3 modular imports only — never `aws-sdk` v2
- Environment variables accessed via `process.env['VAR_NAME']` (bracket notation) in Lambda
- **ALL DynamoDB, AppSync, and Lambda SDK clients MUST include an explicit region:**
  ```typescript
  new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })
  ```
  Never rely on implicit region resolution — it silently fails in Lambda and Next.js server components.
- Module-level SDK clients for Lambda warm reuse — instantiate outside the handler function
- SSE (Server-Sent Events) for real-time shelter updates — no polling from the client
- AppSync subscriptions for real-time Community Chat — no polling
- `USE_MOCK_DATA=true` env var switches dashboard to local mock data (no AWS needed)
- DynamoDB multi-table design:
  - `shelterlink-shelters`: `PK=SHELTER#<id>`, `SK=RECORD#CURRENT` or `SK=LOG#<timestamp>`
  - `shelterlink-chat`: `PK=ROOM#<shelterId>`, `SK=MSG#<timestamp>`
  - `shelterlink-donations`: `PK=USER#<userId>`, `SK=DONATION#<donationId>`

## Pinpoint Status
- AWS Pinpoint SMS requires sandbox approval — resources are commented out in CDK with `TODO` markers
- The Lambda Function URL replaces Pinpoint as the ingestion endpoint for demo and hackathon purposes
- To re-enable Pinpoint: request SMS sandbox access in AWS Console, then uncomment the CDK block

## Common Commands

```bash
# Install all dependencies (from root)
npm install

# Run all tests across workspaces
npm run test --workspaces

# Dashboard
cd packages/dashboard
npm run dev          # local dev server
npm run test         # vitest --run (single pass)
npm run build        # next build
npm run lint         # next lint

# Lambda
cd packages/lambda
npm run build        # esbuild bundle → dist/
npm run test         # vitest --run
npm run coverage     # vitest --run --coverage

# Infra
cd packages/infra
npm run synth        # cdk synth
npm run deploy       # cdk deploy
npm test             # jest
```

## Testing Approach
- Unit tests co-located with source files (`*.test.ts`, `*.test.tsx`)
- Property-based tests use `fast-check` and are named `*.roundtrip.test.ts`
- Key invariant: `parse(formatConfirmation(record))` must round-trip cleanly — covered by `parser.roundtrip.test.ts` and `needs.roundtrip.test.ts`
- Always use `vitest --run` (not watch mode) for CI and scripted test runs
