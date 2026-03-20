# Implementation Plan: ShelterLink

## Overview

Incremental implementation across 9 phases: infrastructure → Lambda processor → dashboard foundation → real-time updates → needs list → admin/auth → accessibility → observability → pivot (Lambda Function URL, AppSync Chat, Inventory, Donations). Each phase builds on the previous and ends with wired, testable code.

## Tasks

- [x] 1. Phase 1 — Infrastructure (CDK Stack)
  - [x] 1.1 Create CDK stack in `packages/infra` with DynamoDB single-table
    - Define `ShelterLinkTable` with `PK` (string) and `SK` (string) composite key
    - Enable DynamoDB Streams (`NEW_AND_OLD_IMAGES`)
    - Set TTL attribute `ttl` on the table
    - Export table name and stream ARN as CDK outputs
    - _Requirements: 8.1, 1.1_

  - [x] 1.2 Add SNS topic, SQS queue, and DLQ to CDK stack
    - Create SNS topic `shelterlink-inbound`
    - Create SQS queue with a DLQ (max receive count: 3)
    - Subscribe SQS queue to SNS topic
    - Wire SQS as Lambda event source for `Update_Processor`
    - _Requirements: 1.1, 8.4_

  - [x] 1.3 Add AWS Pinpoint application resource to CDK stack
    - Create Pinpoint app and SMS channel
    - Store Pinpoint app ID and origination number as SSM parameters
    - _Requirements: 1.1, 1.3_

  - [x] 1.4 Define Lambda execution IAM role with least-privilege policy
    - Scope DynamoDB permissions to specific table ARN
    - Scope Pinpoint permissions to specific app ARN
    - Scope SNS/SQS permissions to specific resource ARNs
    - _Requirements: 8.2_

  - [x] 1.5 Write CDK unit tests for stack resource assertions
    - Assert DynamoDB table exists with correct key schema and stream enabled
    - Assert SQS DLQ is wired to main queue
    - _Requirements: 8.1_

- [x] 2. Phase 2 — Update_Processor Lambda
  - [x] 2.1 Scaffold `packages/lambda` with esbuild config and Vitest setup
  - [x] 2.2 Implement `Parser` module (`src/parser.ts`)
  - [x] 2.3 Write property-based test for Parser round-trip invariant
  - [x] 2.4 Implement `Pretty_Printer` module (`src/prettyPrinter.ts`)
  - [x] 2.5 Write unit tests for Parser and Pretty_Printer
  - [x] 2.6 Implement shelter registry lookup (`src/registry.ts`)
  - [x] 2.7 Implement rate-limit guard (`src/rateLimit.ts`)
  - [x] 2.8 Write unit tests for registry lookup and rate-limit guard
  - [x] 2.9 Implement `Update_Processor` Lambda handler (`src/handler.ts`)
  - [x] 2.10 Write unit tests for Lambda handler orchestration

- [x] 3. Checkpoint — Lambda phase complete

- [x] 4. Phase 3 — Dashboard Foundation
  - [x] 4.1 Scaffold `packages/dashboard` as Next.js App Router project
  - [x] 4.2 Define shared TypeScript types (`src/types/shelter.ts`)
  - [x] 4.3 Implement DynamoDB data-access layer for dashboard (`src/lib/db.ts`)
  - [x] 4.4 Implement SSR home page (`src/app/page.tsx`)
  - [x] 4.5 Implement SSR shelter detail page (`src/app/shelter/[id]/page.tsx`)
  - [x] 4.6 Write unit tests for data-access layer

- [x] 5. Phase 4 — Real-Time Updates (SSE)
  - [x] 5.1 Implement DynamoDB Streams processor Lambda (`src/streamHandler.ts`)
  - [x] 5.2 Implement SSE API route (`src/app/api/updates/route.ts`)
  - [x] 5.3 Implement client-side SSE hook (`src/hooks/useShelterUpdates.ts`)
  - [x] 5.4 Add stale-data warning banner to home page
  - [x] 5.5 Wire SSE hook into home page client component
  - [x] 5.6 Write unit tests for SSE hook

- [x] 6. Checkpoint — Real-time updates wired end-to-end

- [x] 7. Phase 5 — Needs List
  - [x] 7.1 Extend `Parser` to handle needs items in SMS body
  - [x] 7.2 Write property-based test for needs parsing round-trip
  - [x] 7.3 Implement priority filter UI component (`src/components/NeedsFilter.tsx`)
  - [x] 7.4 Integrate Needs_List and filter into shelter detail page
  - [x] 7.5 Write unit tests for NeedsFilter component

- [x] 8. Phase 6 — Admin and Auth
  - [x] 8.1 Configure NextAuth.js with GitHub OAuth provider
  - [x] 8.2 Implement `/admin` layout with session guard
  - [x] 8.3 Implement shelter registry management page
  - [x] 8.4 Implement admin API routes for registry mutations
  - [x] 8.5 Write unit tests for admin API routes

- [x] 9. Phase 7 — Accessibility Pass
  - [x] 9.1 Add ARIA live regions to all real-time update areas
  - [x] 9.2 Audit and fix keyboard navigation across all interactive elements
  - [x] 9.3 Add text alternatives for all non-text status indicators
  - [x] 9.4 Enforce minimum font size and zoom readability
  - [x] 9.5 Write accessibility unit tests for key components

- [x] 10. Phase 8 — Observability
  - [x] 10.1 Add CloudWatch alarms to CDK stack
  - [x] 10.2 Add structured logging to all Lambda handlers
  - [x] 10.3 Write unit tests for structured log output

- [x] 11. Final Checkpoint — All tests pass (Phases 1–8)

- [ ] 12. Phase 9 — Architecture Pivot
  - [ ] 12.1 Add Lambda Function URL to CDK stack
    - Add `FunctionUrl` resource to `UpdateProcessor` Lambda with `authType: NONE`
    - Configure CORS: `allowOrigins: [process.env.ALLOWED_ORIGIN ?? '*']`, `allowMethods: [HttpMethod.POST]`
    - Export Function URL as CDK output
    - Update Lambda handler to accept both SQS envelope and raw HTTP POST `{ phone, body }`
    - _Requirements: 1.1, 1.7, 9.1_

  - [ ] 12.2 Add explicit region to all SDK clients
    - Update `handler.ts`, `registry.ts`, `rateLimit.ts`, `streamHandler.ts` to use `region: process.env['AWS_REGION'] ?? 'us-east-1'` in all client constructors
    - Update `packages/dashboard/src/lib/db.ts` and `registry.ts` to include explicit region
    - Update CDK stack `env` prop to pin `region: 'us-east-1'`
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 12.3 Add Chat and Donations DynamoDB tables to CDK stack
    - Create `shelterlink-chat` table: `PK=ROOM#<shelterId>`, `SK=MSG#<timestamp>`, TTL=30 days
    - Create `shelterlink-donations` table: `PK=USER#<userId>`, `SK=DONATION#<donationId>`
    - Add GSI on `shelterlink-donations`: partition key `shelterId`, sort key `pledgedAt`
    - Export table names as CDK outputs
    - _Requirements: 5.6, 6.3_

  - [ ] 12.4 Add AppSync GraphQL API to CDK stack
    - Create AppSync API with DynamoDB data source pointing to `shelterlink-chat`
    - Define schema: `sendMessage` mutation, `getMessages` query, `onNewMessage` subscription
    - Configure API key auth for public read; export endpoint URL and API key
    - _Requirements: 5.1, 5.2_

  - [ ] 12.5 Extend DynamoDB types for inventory, chat, and donations
    - Add `inventory: Record<string, number>` to `ShelterRecord` in `packages/dashboard/src/types/shelter.ts`
    - Add `ChatMessage` type: `{ roomId, timestamp, senderName, message, userType }`
    - Add `DonationRecord` type: `{ userId, donationId, shelterId, items, status, pledgedAt }`
    - Mirror relevant types in `packages/lambda/src/types.ts`
    - _Requirements: 4.1, 5.3, 6.3_

  - [ ] 12.6 Implement Community Chat component (`src/components/CommunityChat.tsx`)
    - `"use client"` component that subscribes to AppSync `onNewMessage(roomId)`
    - Load last 50 messages on mount via `getMessages` query
    - Display sender name, user type badge, message, and timestamp
    - Show "No messages yet" empty state
    - Input field + send button; submit calls `sendMessage` mutation
    - `aria-live="polite"` on message list for screen reader announcements
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.4_

  - [ ] 12.7 Implement Inventory panel (`src/components/InventoryPanel.tsx`)
    - Read-only view for volunteers/donors: item name + quantity, "Out of stock" for zero quantities
    - Admin edit mode: quantity input per item, save calls `PATCH /api/admin/shelters/[id]/inventory`
    - Integrate into shelter detail page (`src/app/shelter/[id]/page.tsx`)
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ] 12.8 Implement inventory admin API route
    - `PATCH /api/admin/shelters/[id]/inventory` — validate session + origin, call DynamoDB `UpdateItem` with `SET inventory.#item = :qty`
    - Use expression attribute names to handle arbitrary item name keys safely
    - _Requirements: 4.2, 4.5, 8.5_

  - [ ] 12.9 Implement Donation pledge form and API
    - `src/app/donate/[shelterId]/page.tsx` — public SSR page with pledge form
    - `src/components/DonationForm.tsx` — `"use client"` form: donor name, email, items + quantities
    - `POST /api/donations` — write to `shelterlink-donations` table, return confirmation
    - Mock path: return success immediately when `USE_MOCK_DATA=true`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 12.10 Add donation management to admin panel
    - Extend `src/app/admin/page.tsx` to show pending pledges per shelter (query GSI)
    - `PATCH /api/admin/donations/[donationId]` — mark pledge as `DELIVERED`, set `deliveredAt`
    - _Requirements: 6.4, 6.5_

  - [ ] 12.11 Add "Mock-to-Prod" environment toggle hook
    - Create Kiro hook `.kiro/hooks/env-toggle.json` — `userTriggered` event
    - Hook action: `runCommand` that toggles `USE_MOCK_DATA` between `true` and `false` in `.env.local` and restarts the dev server
    - _Requirements: 9.4_

  - [ ] 12.12 Write tests for pivot features
    - Unit test Lambda Function URL handler path (HTTP POST envelope parsing)
    - Unit test inventory `UpdateItem` expression builder
    - Unit test donation API route (mock DynamoDB, assert correct PK/SK written)
    - _Requirements: 1.1, 4.2, 6.2_

- [ ] 13. Final Checkpoint — Phase 9 complete
  - Run `vitest --run` in `packages/lambda` and `packages/dashboard`
  - Run CDK synth in `packages/infra` to validate stack compiles without errors

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with Vitest; install `fast-check` in `packages/lambda`
- Phone numbers must never appear in plaintext in logs — use masked format `+1***XXXX`
- All Lambda handlers must use `@aws-lambda-powertools/logger`; no `console.log`
- Admin routes must validate both NextAuth session and `Origin` header on every mutating request
- All AWS SDK clients must include `region: process.env['AWS_REGION'] ?? 'us-east-1'`
