# Implementation Plan: SMS Broadcast Alerts

## Overview

Extend the existing ShelterLink Lambda and Next.js dashboard to support outbound SMS broadcast alerts. The work touches four areas: (1) new shared types, (2) a new `broadcastService.ts` module in the Lambda package, (3) extensions to `streamHandler.ts` and `handler.ts`, and (4) new Next.js API routes and a React subscription form. CDK gets a GSI and two new env vars on the Stream_Handler. No new tables, no new Lambda functions, no new event sources.

## Tasks

- [x] 1. Extend shared types in `packages/lambda/src/types.ts`
  - Add `SubscriptionStatus`, `AlertTriggerType`, `SubscriptionRecord`, and `AlertTrigger` interfaces as specified in the design data models section
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Add `subscribers-by-shelter` GSI and Stream_Handler env vars in CDK
  - [x] 2.1 Add GSI to the existing `shelterlink-data` table in `packages/infra/lib/shelter-link-stack.ts`
    - `indexName: 'subscribers-by-shelter'`, partition key `shelterId` (String), sort key `status` (String), `ProjectionType.ALL`
    - _Requirements: 6.3_
  - [x] 2.2 Add IAM policy statement granting `dynamodb:Query` on the new GSI ARN to `lambdaRole`
    - _Requirements: 6.3, 7.2_
  - [x] 2.3 Add `SHELTER_TABLE`, `PINPOINT_APP_ID`, and `ORIGINATION_NUMBER` to the `streamHandler` Lambda `environment` block in CDK
    - Pull `PINPOINT_APP_ID` and `ORIGINATION_NUMBER` from SSM the same way `updateProcessor` does
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Implement `broadcastService.ts` in `packages/lambda/src/`
  - [x] 3.1 Implement `evaluateTriggers(newImage, oldImage)` — pure function, no I/O
    - Returns `AlertTrigger | null` based on status transitions (FULL, CLOSED, OPEN recovery) and new CRITICAL needs items
    - Compare old vs new `needsList` by item name to detect newly added CRITICAL items
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [ ]* 3.2 Write property test for `evaluateTriggers` — `packages/lambda/src/broadcastService.pbt.test.ts`
    - **Property 7: Trigger condition correctness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**
    - Use `fc.record({ oldStatus, newStatus, oldNeeds, newNeeds })` covering all status combinations
    - Tag: `// Feature: sms-broadcast-alerts, Property 7: Trigger condition correctness`
  - [x] 3.3 Implement `formatAlertMessage(trigger)` — pure function
    - Formats messages per requirements 4.1–4.5; truncates shelter name if message exceeds 160 chars; always ends with `"Reply STOP to unsubscribe."`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [ ]* 3.4 Write property test for `formatAlertMessage` — in `broadcastService.pbt.test.ts`
    - **Property 8: Alert message format correctness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 4.7**
    - Use long shelter name generator (50+ chars) to exercise truncation
    - Tag: `// Feature: sms-broadcast-alerts, Property 8: Alert message format correctness`
  - [ ]* 3.5 Write property test for single-SMS multi-CRITICAL fan-out — in `broadcastService.pbt.test.ts`
    - **Property 9: Multiple CRITICAL items produce a single SMS**
    - **Validates: Requirements 4.5**
    - Tag: `// Feature: sms-broadcast-alerts, Property 9: Multiple CRITICAL items produce a single SMS`
  - [x] 3.6 Implement `broadcastAlerts(trigger, subscribers, pinpointClient, logger)`
    - Skip silently if `PINPOINT_APP_ID` is absent or `'PENDING'`; log WARN per failed delivery; never throw; use `maskPhone()` in all log entries
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.1, 9.5, 10.1, 10.2_
  - [ ]* 3.7 Write property test for partial delivery failure resilience — in `broadcastService.pbt.test.ts`
    - **Property 10: Partial delivery failure resilience**
    - **Validates: Requirements 5.5, 5.6**
    - Mix ACTIVE and UNSUBSCRIBED records; inject a mock Pinpoint client that fails on a random subset
    - Tag: `// Feature: sms-broadcast-alerts, Property 10: Partial delivery failure resilience`
  - [ ]* 3.8 Write unit tests for `broadcastService.ts` — `packages/lambda/src/broadcastService.test.ts`
    - Cover: `formatAlertMessage` concrete examples for each trigger type, Pinpoint PENDING skip, WARN log on single failure, zero-subscriber no-op
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.4_

- [x] 4. Checkpoint — ensure Lambda unit and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend `streamHandler.ts` with broadcast fan-out
  - [x] 5.1 Add module-level `PinpointClient` (with explicit region) to `streamHandler.ts`
    - _Requirements: 5.3_
  - [x] 5.2 After the existing `PutCommand` for SSE, extract `oldImage` from `record.dynamodb.OldImage`, call `evaluateTriggers`, query the `subscribers-by-shelter` GSI for ACTIVE subscribers (paginated), and call `broadcastAlerts`
    - Log INFO when trigger is null or zero subscribers found; push to `batchItemFailures` on GSI query error or `broadcastAlerts` throw
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.3_
  - [ ]* 5.3 Write property test for Stream_Handler batch failure reporting — `packages/lambda/src/streamHandler.pbt.test.ts`
    - **Property 12: Stream_Handler batch item failure reporting**
    - **Validates: Requirements 7.4**
    - Tag: `// Feature: sms-broadcast-alerts, Property 12: Stream_Handler batch item failure reporting`
  - [ ]* 5.4 Write unit tests for `streamHandler.ts` — `packages/lambda/src/streamHandler.test.ts`
    - Cover: non-`RECORD#CURRENT` SK skip, null trigger skip, zero-subscriber skip, broadcast error → `batchItemFailures`
    - _Requirements: 7.1, 7.4, 7.5_

- [x] 6. Extend `handler.ts` with STOP/START keyword handling
  - [x] 6.1 Implement `unsubscribePhone(phone, ddbClient, table)` and `resubscribePhone(phone, ddbClient, table)` helper functions (can live in a new `packages/lambda/src/subscription.ts` module)
    - `unsubscribePhone`: Query `PK=SUBSCRIBER#<hash>`, batch `UpdateItem` each record to `status=UNSUBSCRIBED`
    - `resubscribePhone`: same pattern, set `status=ACTIVE`
    - Use `maskPhone()` in all log entries; never log raw phone
    - _Requirements: 2.1, 2.2, 2.3, 9.1_
  - [ ]* 6.2 Write property tests for subscription helpers — `packages/lambda/src/subscription.pbt.test.ts`
    - **Property 4: Unsubscribe sets all records to UNSUBSCRIBED**
    - **Validates: Requirements 2.1**
    - Tag: `// Feature: sms-broadcast-alerts, Property 4: Unsubscribe sets all records to UNSUBSCRIBED`
    - **Property 5: STOP/START keyword case-insensitivity**
    - **Validates: Requirements 2.2, 2.3**
    - Tag: `// Feature: sms-broadcast-alerts, Property 5: STOP/START keyword case-insensitivity`
    - **Property 6: UNSUBSCRIBED subscribers never receive broadcasts**
    - **Validates: Requirements 2.5**
    - Tag: `// Feature: sms-broadcast-alerts, Property 6: UNSUBSCRIBED subscribers never receive broadcasts`
  - [x] 6.3 In `processUpdate()` in `handler.ts`, add STOP/START detection before the registry lookup
    - Trim + uppercase the body; if `STOP` → call `unsubscribePhone`, send confirmation SMS, return null; if `START` → call `resubscribePhone`, return null
    - _Requirements: 2.2, 2.3, 2.6_

- [x] 7. Implement Opt_In_API — `packages/dashboard/src/app/api/alerts/subscribe/route.ts`
  - Validate E.164 with `/^\+[1-9]\d{1,14}$/`; hash phone with SHA-256; `PutItem` with `ConditionExpression: "attribute_not_exists(PK)"` (swallow condition failure for idempotence); send confirmation SMS via Pinpoint; log structured INFO with `maskedPhone`; never return raw phone in response body
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 9.2, 9.3, 10.4_
  - [ ]* 7.1 Write property test for Opt_In_API — `packages/dashboard/src/app/api/alerts/subscribe/route.pbt.test.ts`
    - **Property 1: E.164 validation rejects all non-conforming inputs**
    - **Validates: Requirements 1.2, 1.3**
    - Tag: `// Feature: sms-broadcast-alerts, Property 1: E.164 validation rejects all non-conforming inputs`
    - **Property 11: API responses never contain raw phone numbers**
    - **Validates: Requirements 9.3**
    - Tag: `// Feature: sms-broadcast-alerts, Property 11: API responses never contain raw phone numbers`
  - [ ]* 7.2 Write property test for subscription idempotence — in `route.pbt.test.ts`
    - **Property 2: Subscription creation idempotence**
    - **Validates: Requirements 1.4**
    - Tag: `// Feature: sms-broadcast-alerts, Property 2: Subscription creation idempotence`
  - [ ]* 7.3 Write property test for subscription record completeness — in `route.pbt.test.ts`
    - **Property 3: Subscription record completeness**
    - **Validates: Requirements 1.5, 6.1, 6.2, 6.4, 6.5**
    - Tag: `// Feature: sms-broadcast-alerts, Property 3: Subscription record completeness`
  - [ ]* 7.4 Write unit tests for Opt_In_API — `packages/dashboard/src/app/api/alerts/subscribe/route.test.ts`
    - Cover: happy path 200, duplicate idempotence 200, missing fields 400, invalid E.164 400, DynamoDB error 500
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 8. Implement Opt_Out_API — `packages/dashboard/src/app/api/alerts/unsubscribe/route.ts`
  - Validate E.164; hash phone; Query `PK=SUBSCRIBER#<hash>`; batch `UpdateItem` to `UNSUBSCRIBED`; return 200 always (no-op if no records); log structured INFO with `maskedPhone` and count; never return raw phone in response
  - _Requirements: 2.1, 9.3, 9.4, 10.5_
  - [ ]* 8.1 Write unit tests for Opt_Out_API — `packages/dashboard/src/app/api/alerts/unsubscribe/route.test.ts`
    - Cover: happy path, no-op on missing record, invalid E.164 400, DynamoDB error 500
    - _Requirements: 2.1_

- [x] 9. Implement `AlertSubscribeForm` component — `packages/dashboard/src/components/AlertSubscribeForm.tsx`
  - Phone input accepting `+`, digits, spaces, dashes, parentheses; client-side E.164 normalization (strip non-digits, prepend `+1` if no country code); calls `POST /api/alerts/subscribe`; inline success/error state; unsubscribe link calls `POST /api/alerts/unsubscribe`; never expose raw API errors or stack traces
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ]* 9.1 Write property test for client-side phone normalization — `packages/dashboard/src/components/AlertSubscribeForm.pbt.test.tsx`
    - **Property 13: Client-side phone normalization**
    - **Validates: Requirements 8.6**
    - Use `fc.string()` composed of digits, spaces, dashes, parens, optional leading `+`
    - Tag: `// Feature: sms-broadcast-alerts, Property 13: Client-side phone normalization`
  - [ ]* 9.2 Write unit tests for `AlertSubscribeForm` — `packages/dashboard/src/components/AlertSubscribeForm.test.tsx`
    - Cover: form renders, submit calls API, success state shown, error state shown, unsubscribe click
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Wire `AlertSubscribeForm` into the shelter detail page
  - Import and render `<AlertSubscribeForm shelterId={params.id} />` in `packages/dashboard/src/app/shelter/[id]/page.tsx`
  - _Requirements: 8.1_

- [x] 11. Final checkpoint — ensure all tests pass
  - Ensure all tests pass across `packages/lambda` and `packages/dashboard`, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests require minimum 100 iterations each (`fc.assert(fc.property(...), { numRuns: 100 })`)
- All log entries referencing phone numbers must use `maskPhone()` — never log raw E.164
- `broadcastService.ts` accepts injected clients (no module-level state) for testability
- The `subscribers-by-shelter` GSI query must paginate via `LastEvaluatedKey` to handle shelters with many subscribers
- CDK `cdk synth` must pass after task 2 before proceeding to Lambda tasks
