# Implementation Plan: ShelterLink

## Overview

Incremental implementation across 8 phases: infrastructure → Lambda processor → dashboard foundation → real-time updates → needs list → admin/auth → accessibility → observability. Each phase builds on the previous and ends with wired, testable code.

## Tasks

- [x] 1. Phase 1 — Infrastructure (CDK Stack)
  - [x] 1.1 Create CDK stack in `packages/infra` with DynamoDB single-table
    - Define `ShelterLinkTable` with `PK` (string) and `SK` (string) composite key
    - Enable DynamoDB Streams (`NEW_AND_OLD_IMAGES`)
    - Set TTL attribute `ttl` on the table
    - Export table name and stream ARN as CDK outputs
    - _Requirements: 5.1, 1.1_

  - [x] 1.2 Add SNS topic, SQS queue, and DLQ to CDK stack
    - Create SNS topic `shelterlink-inbound`
    - Create SQS queue with a DLQ (max receive count: 3)
    - Subscribe SQS queue to SNS topic
    - Wire SQS as Lambda event source for `Update_Processor`
    - _Requirements: 1.1, 5.4_

  - [x] 1.3 Add AWS Pinpoint application resource to CDK stack
    - Create Pinpoint app and SMS channel
    - Store Pinpoint app ID and origination number as SSM parameters
    - _Requirements: 1.1, 1.3_

  - [x] 1.4 Define Lambda execution IAM role with least-privilege policy
    - Scope DynamoDB permissions to specific table ARN
    - Scope Pinpoint permissions to specific app ARN
    - Scope SNS/SQS permissions to specific resource ARNs
    - _Requirements: 5.2_

  - [x] 1.5 Write CDK unit tests for stack resource assertions
    - Assert DynamoDB table exists with correct key schema and stream enabled
    - Assert SQS DLQ is wired to main queue
    - _Requirements: 5.1_

- [x] 2. Phase 2 — Update_Processor Lambda
  - [x] 2.1 Scaffold `packages/lambda` with esbuild config and Vitest setup
    - Configure `tsconfig.json` with `strict: true`, `target: ES2022`
    - Configure esbuild bundle script for Lambda handler output
    - Configure Vitest with coverage thresholds
    - _Requirements: 1.1_

  - [x] 2.2 Implement `Parser` module (`src/parser.ts`)
    - Parse SMS body into `CapacityRecord` type: `{ beds, capacity, status, needsList }`
    - Accept case-insensitive, whitespace-tolerant input (regex-based)
    - Return `ParseResult` discriminated union: `{ ok: true, record }` | `{ ok: false, error }`
    - Assign default priority `MEDIUM` when need item omits priority
    - _Requirements: 1.4, 1.5, 3.2, 3.3_

  - [x] 2.3 Write property-based test for Parser round-trip invariant
    - **Property 1: Round-trip consistency — parse(prettyPrint(parse(sms))) produces equivalent CapacityRecord**
    - **Validates: Requirements 1.6**
    - Use `@fast-check/vitest` or `fast-check` with Vitest
    - Generate arbitrary valid SMS strings and assert structural equivalence after round-trip

  - [x] 2.4 Implement `Pretty_Printer` module (`src/prettyPrinter.ts`)
    - Format `CapacityRecord` into human-readable confirmation SMS string
    - Format error reply with example correct format
    - _Requirements: 1.3, 1.4_

  - [x] 2.5 Write unit tests for Parser and Pretty_Printer
    - Test valid formats: beds only, beds + needs, needs with mixed priorities
    - Test invalid formats: empty body, unknown keywords, malformed numbers
    - Test default priority assignment when priority omitted
    - _Requirements: 1.4, 1.5, 3.3_

  - [x] 2.6 Implement shelter registry lookup (`src/registry.ts`)
    - Query DynamoDB for `PK=REGISTRY#<hashedPhone>` to validate sender
    - Return `{ authorized: boolean, shelterId?: string }`
    - Mask phone number in all log statements using `+1***XXXX` format
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 2.7 Implement rate-limit guard (`src/rateLimit.ts`)
    - Track unauthorized attempt count in DynamoDB (`PK=RATELIMIT#<hashedPhone>`, TTL 10 min)
    - Suppress reply after 5 unauthorized attempts within 10 minutes for 60 minutes
    - _Requirements: 5.3_

  - [x] 2.8 Write unit tests for registry lookup and rate-limit guard
    - Test authorized and unauthorized phone number scenarios
    - Test rate-limit threshold boundary (5th attempt triggers suppression)
    - Test suppression window expiry
    - _Requirements: 5.2, 5.3_

  - [x] 2.9 Implement `Update_Processor` Lambda handler (`src/handler.ts`)
    - Parse SNS/SQS event envelope to extract SMS body and sender phone
    - Orchestrate: registry check → rate-limit check → parse → DynamoDB write → Pinpoint reply
    - Write `RECORD#CURRENT` and `LOG#<timestamp>` items to DynamoDB
    - Use `@aws-lambda-powertools/logger` for all structured logging; no `console.log`
    - Read config from env vars: `SHELTER_TABLE`, `PINPOINT_APP_ID`, `ORIGINATION_NUMBER`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2, 5.4_

  - [x] 2.10 Write unit tests for Lambda handler orchestration
    - Mock DynamoDB, Pinpoint, registry, and rate-limit modules
    - Test happy path: valid SMS → DynamoDB write → confirmation SMS
    - Test unauthorized sender → error reply (no DynamoDB write)
    - Test parse failure → error reply with format example
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Checkpoint — Lambda phase complete
  - Ensure all Lambda tests pass (`vitest --run` in `packages/lambda`)
  - Ask the user if questions arise before proceeding.

- [x] 4. Phase 3 — Dashboard Foundation
  - [x] 4.1 Scaffold `packages/dashboard` as Next.js App Router project
    - Initialize with TypeScript strict mode and `src/app` directory structure
    - Install and configure Tailwind CSS
    - Define WCAG 2.1 AA color tokens in `tailwind.config.ts` (4.5:1 text contrast, 3:1 UI contrast)
    - _Requirements: 4.1, 2.5_

  - [x] 4.2 Define shared TypeScript types (`src/types/shelter.ts`)
    - `ShelterRecord`, `CapacityRecord`, `NeedsItem`, `Priority` enum
    - Shared between dashboard and lambda via a `packages/shared` module or inline
    - _Requirements: 2.1, 3.1_

  - [x] 4.3 Implement DynamoDB data-access layer for dashboard (`src/lib/db.ts`)
    - `getAllShelters()` — scan/query all `RECORD#CURRENT` items
    - `getShelterById(id)` — get single shelter record
    - Use `@aws-sdk/lib-dynamodb` DocumentClient with typed inputs
    - _Requirements: 2.1_

  - [x] 4.4 Implement SSR home page (`src/app/page.tsx`)
    - Server component: fetch all shelters via `getAllShelters()` at request time
    - Render shelter cards with bed availability, occupancy %, status label, and last-updated timestamp
    - Display shelter location and contact info without horizontal scroll at 320px+
    - Include `"No shelters available"` empty state
    - _Requirements: 2.1, 2.5, 2.6_

  - [x] 4.5 Implement SSR shelter detail page (`src/app/shelter/[id]/page.tsx`)
    - Server component: fetch single shelter and render Needs_List ordered by priority descending
    - Display `"No current needs"` when Needs_List is empty
    - _Requirements: 3.1, 3.6_

  - [x]* 4.6 Write unit tests for data-access layer
    - Mock DynamoDB DocumentClient responses
    - Test `getAllShelters` and `getShelterById` return correct typed records
    - _Requirements: 2.1_

- [x] 5. Phase 4 — Real-Time Updates (SSE)
  - [x] 5.1 Implement DynamoDB Streams processor Lambda (`packages/lambda/src/streamHandler.ts`)
    - Triggered by DynamoDB Stream on `RECORD#CURRENT` item changes
    - Publish change payload to a connection registry (DynamoDB connection table)
    - _Requirements: 2.2, 2.3_

  - [x] 5.2 Implement SSE API route (`src/app/api/updates/route.ts`)
    - Stream `text/event-stream` response to connected clients
    - Poll connection table or use long-poll pattern to push DynamoDB Stream events
    - Set appropriate headers: `Cache-Control: no-cache`, `Connection: keep-alive`
    - _Requirements: 2.3_

  - [x] 5.3 Implement client-side SSE hook (`src/hooks/useShelterUpdates.ts`)
    - `"use client"` hook that opens `EventSource` to `/api/updates`
    - Merge incoming JSON patches into local shelter state
    - Track connection status: `connected` | `disconnected` | `stale`
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 5.4 Add stale-data warning banner to home page
    - Show banner with last-successful-update timestamp when SSE connection is lost
    - Use `aria-live="polite"` on the banner region
    - _Requirements: 2.4, 4.4_

  - [x] 5.5 Wire SSE hook into home page client component
    - Wrap shelter list in a `"use client"` component that hydrates from SSR props and subscribes to SSE
    - Update shelter cards reactively on incoming events without full reload
    - _Requirements: 2.2, 2.3_

  - [x]* 5.6 Write unit tests for SSE hook
    - Mock `EventSource` and assert state transitions on connect, message, and error events
    - Assert stale state is set after connection loss
    - _Requirements: 2.4_

- [x] 6. Checkpoint — Real-time updates wired end-to-end
  - Ensure all dashboard and Lambda tests pass
  - Ask the user if questions arise before proceeding.

- [x] 7. Phase 5 — Needs List
  - [x] 7.1 Extend `Parser` to handle needs items in SMS body
    - Parse `NEEDS item:priority, item` syntax from SMS
    - Parse `FULFILLED item` syntax to mark needs as fulfilled
    - _Requirements: 3.2, 3.3, 3.5_

  - [x]* 7.2 Write property-based test for needs parsing round-trip
    - **Property 2: Needs round-trip — parse(prettyPrint(record)).needsList deep-equals record.needsList**
    - **Validates: Requirements 1.6, 3.2**
    - Generate arbitrary needs lists with mixed priorities and assert round-trip equivalence

  - [x] 7.3 Implement priority filter UI component (`src/components/NeedsFilter.tsx`)
    - `"use client"` component with filter buttons for Critical / High / Medium / Low / All
    - Filter operates on client state without page reload
    - Each button has visible focus indicator and `aria-pressed` state
    - _Requirements: 3.4, 4.2_

  - [x] 7.4 Integrate Needs_List and filter into shelter detail page
    - Pass server-fetched needs to `NeedsFilter` as initial props
    - Display `"No current needs"` when filtered or unfiltered list is empty
    - _Requirements: 3.1, 3.4, 3.6_

  - [x]* 7.5 Write unit tests for NeedsFilter component
    - Test filter buttons toggle `aria-pressed` correctly
    - Test filtered output matches selected priority
    - Test empty state renders `"No current needs"` message
    - _Requirements: 3.4, 3.6_

- [ ] 8. Phase 6 — Admin and Auth
  - [ ] 8.1 Configure NextAuth.js with GitHub OAuth provider (`src/app/api/auth/[...nextauth]/route.ts`)
    - Set `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` env vars
    - Restrict sign-in to allowed GitHub org or email list via `signIn` callback
    - _Requirements: 5.5_

  - [ ] 8.2 Implement `/admin` layout with session guard (`src/app/admin/layout.tsx`)
    - Server component: redirect to sign-in if no valid session
    - _Requirements: 5.5_

  - [ ] 8.3 Implement shelter registry management page (`src/app/admin/page.tsx`)
    - List registered shelters with masked phone numbers
    - Forms to add and remove shelter registrations
    - _Requirements: 5.1, 5.5_

  - [ ] 8.4 Implement admin API routes for registry mutations
    - `POST /api/admin/shelters` — add shelter registration
    - `DELETE /api/admin/shelters/[id]` — remove shelter registration
    - Validate NextAuth session token before any write
    - Validate `Origin` header against `NEXT_PUBLIC_ALLOWED_ORIGIN`
    - _Requirements: 5.1, 5.5_

  - [ ]* 8.5 Write unit tests for admin API routes
    - Test unauthenticated request returns 401
    - Test invalid `Origin` header returns 403
    - Test valid session + valid origin executes write
    - _Requirements: 5.5_

- [ ] 9. Phase 7 — Accessibility Pass
  - [ ] 9.1 Add ARIA live regions to all real-time update areas
    - Wrap shelter card list in `<div aria-live="polite" aria-atomic="false">`
    - Wrap stale-data banner in `<div role="status" aria-live="polite">`
    - _Requirements: 4.4_

  - [ ] 9.2 Audit and fix keyboard navigation across all interactive elements
    - Ensure all buttons, links, and filter controls are reachable via Tab
    - Ensure visible `:focus-visible` ring on all interactive elements (Tailwind `focus-visible:ring`)
    - Ensure modal/dialog (if any) traps focus correctly
    - _Requirements: 4.2_

  - [ ] 9.3 Add text alternatives for all non-text status indicators
    - Status badges must include both color class and text label
    - Capacity bar/icon must have `aria-label` with numeric value
    - Priority icons in Needs_List must have `aria-label`
    - _Requirements: 4.3, 4.5_

  - [ ] 9.4 Enforce minimum font size and zoom readability
    - Set `html { font-size: 16px }` base in global CSS
    - Verify layout does not break at 200% browser zoom (no overflow clipping of text)
    - _Requirements: 4.6_

  - [ ]* 9.5 Write accessibility unit tests for key components
    - Use `@testing-library/react` with `jest-axe` or `vitest-axe` to assert no axe violations
    - Test shelter card, needs list item, and filter button components
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10. Phase 8 — Observability
  - [ ] 10.1 Add CloudWatch alarms to CDK stack
    - Alarm on Lambda `Update_Processor` error rate > 1% over 5 minutes
    - Alarm on DLQ `ApproximateNumberOfMessagesVisible` > 0
    - Alarm on DynamoDB `ThrottledRequests` > 0
    - _Requirements: 1.1_

  - [ ] 10.2 Add structured logging to all Lambda handlers
    - Ensure every handler uses `@aws-lambda-powertools/logger` with `LOG_LEVEL` env var
    - Log inbound SMS attempt with masked phone, timestamp, and outcome (authorized/unauthorized/parse-error)
    - _Requirements: 5.4_

  - [ ]* 10.3 Write unit tests for structured log output
    - Assert logger is called with correct masked phone format on unauthorized attempt
    - Assert no raw phone number appears in any log message
    - _Requirements: 5.4_

- [ ] 11. Final Checkpoint — All tests pass
  - Run `vitest --run` in `packages/lambda` and `packages/dashboard`
  - Run CDK synth in `packages/infra` to validate stack compiles without errors
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with Vitest; install `fast-check` in `packages/lambda`
- Phone numbers must never appear in plaintext in logs — use masked format `+1***XXXX`
- All Lambda handlers must use `@aws-lambda-powertools/logger`; no `console.log`
- Admin routes must validate both NextAuth session and `Origin` header on every mutating request
