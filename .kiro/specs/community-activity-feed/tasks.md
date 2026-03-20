# Implementation Plan: Community Activity Feed

## Overview

Most of the feature is already implemented. These tasks cover the remaining runtime fix, test infrastructure, property-based tests, and unit tests — ordered by impact.

## Tasks

- [x] 1. Fix mock path in `executeAlertTool` so live pledges appear in chat
  - [x] 1.1 Extract `MOCK_MESSAGES` to a shared module `packages/dashboard/src/lib/mockChat.ts`
    - Create `mockChat.ts` exporting a mutable `MOCK_MESSAGES: ChatMessage[]` array seeded with the existing per-shelter messages currently defined inline in `chat/[shelterId]/route.ts`
    - _Requirements: 1.6_

  - [x] 1.2 Update `chat/[shelterId]/route.ts` to import `MOCK_MESSAGES` from `mockChat.ts`
    - Remove the inline `MOCK_MESSAGES` array definition
    - Import `{ MOCK_MESSAGES }` from `@/lib/mockChat`
    - All existing GET/POST mock-mode logic continues to read/write the same array
    - _Requirements: 1.6, 6.1, 6.5_

  - [x] 1.3 Update `executeAlertTool` in `advocate/route.ts` to push to `MOCK_MESSAGES` in mock mode
    - Import `{ MOCK_MESSAGES }` from `@/lib/mockChat` at the top of the file
    - Replace the mock-mode early-return in `executeAlertTool` with a push of a `ChatMessage` (`roomId`, `timestamp`, `senderName: 'Community Advocate'`, `message`, `userType: 'ADMIN'`) to `MOCK_MESSAGES`
    - Keep the non-fatal `try/catch` wrapping the auto-call from `executePledgeTool` — pledge must still succeed if this throws
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 1.4 Checkpoint — verify mock pledge flow end-to-end
    - Ensure all tests pass, ask the user if questions arise.

- [x] 2. Install `fast-check` and configure property-based test infrastructure
  - [x] 2.1 Add `fast-check` to `packages/dashboard` dev dependencies
    - Run `npm install --save-dev fast-check` inside `packages/dashboard`
    - Confirm `fast-check` appears in `package.json` devDependencies
    - _Requirements: (test infrastructure — supports all property tests)_

- [x] 3. Property-based tests for chat API route
  - [x] 3.1 Create `packages/dashboard/src/app/api/chat/[shelterId]/route.pbt.test.ts`
    - Scaffold the file with vitest + fast-check imports and a `beforeEach` that resets `MOCK_MESSAGES` to an empty array before each property run
    - _Requirements: 1.5, 1.6, 6.5, 7.5, 7.6_

  - [x] 3.2 Write property test for P7: chat endpoint shelter filtering
    - **Property 7: Chat endpoint shelter filtering**
    - For any `shelterId` string, a GET to `/api/chat/[shelterId]` in mock mode returns only messages where `roomId === shelterId`
    - Use `fc.string({ minLength: 1 })` for shelterId; seed `MOCK_MESSAGES` with messages for multiple shelter IDs before asserting
    - **Validates: Requirements 6.5**

  - [x] 3.3 Write property test for P8: POST rejects empty/whitespace message
    - **Property 8: POST endpoint rejects empty message**
    - For any body where `message` is absent, `""`, or a whitespace-only string, POST returns HTTP 400 with `{ error: "Missing message" }`
    - Use `fc.oneof(fc.constant(''), fc.constant(undefined), fc.stringOf(fc.constant(' '), { minLength: 1 }))` for the message value
    - **Validates: Requirements 7.5**

  - [x] 3.4 Write property test for P9: POST coerces invalid userType to VOLUNTEER
    - **Property 9: POST endpoint coerces invalid userType**
    - For any `userType` value that is not `"VOLUNTEER"`, `"DONOR"`, or `"STAFF"`, the stored message has `userType === "VOLUNTEER"`
    - Use `fc.string().filter(s => !['VOLUNTEER','DONOR','STAFF'].includes(s))` for userType
    - **Validates: Requirements 7.6**

- [x] 4. Property-based tests for pledge notification format and mock store write
  - [x] 4.1 Create `packages/dashboard/src/app/api/advocate/advocate.pbt.test.ts`
    - Scaffold the file; mock `MOCK_MESSAGES` from `@/lib/mockChat` so tests can inspect pushes without a real Bedrock call
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 4.2 Write property test for P1: pledge notification format
    - **Property 1: Pledge notification format**
    - For any combination of `donorName` (including absent/empty), `quantity` (including absent), `item`, and `shelterId`, the `ChatMessage` pushed to `MOCK_MESSAGES` by `executeAlertTool` has `senderName === "Community Advocate"`, `userType === "ADMIN"`, `roomId === shelterId`, and `message` matching `/^🤝 .+ has pledged to donate \d+× .+$/`; `donorName` absent/empty → `"Anonymous"`, `quantity` absent → `1`
    - Use `fc.record({ donorName: fc.option(fc.string()), quantity: fc.option(fc.nat()), item: fc.string({ minLength: 1 }), shelterId: fc.string({ minLength: 1 }) })`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.6**

  - [x] 4.3 Write property test for P2: pledge written to mock store
    - **Property 2: Pledge notification written to mock store**
    - For any valid pledge input in mock mode, after `executePledgeTool` completes, `MOCK_MESSAGES` contains exactly one new message with `senderName === "Community Advocate"` and `userType === "ADMIN"` compared to the pre-pledge snapshot
    - **Validates: Requirements 1.6, 1.5**

- [x] 5. Property-based tests for CommunityChat rendering
  - [x] 5.1 Create `packages/dashboard/src/components/CommunityChat.pbt.test.tsx`
    - Scaffold with vitest + fast-check + `@testing-library/react` imports
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 5.2 Write property test for P3: advocate message rendering
    - **Property 3: Advocate message rendering**
    - For any `ChatMessage` where `isAdvocateMessage` returns `true` (i.e. `senderName === "Community Advocate"` and `userType === "ADMIN"`), the rendered `<li>` contains the teal background class, sender name in teal text, message body in teal with `font-medium`, and no `UserType` badge element
    - Use `fc.record({ senderName: fc.constant('Community Advocate'), userType: fc.constant('ADMIN'), message: fc.string(), roomId: fc.string({ minLength: 1 }), timestamp: fc.date().map(d => d.toISOString()) })`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 5.3 Write property test for P4: non-advocate message badge rendering
    - **Property 4: Non-advocate message badge rendering**
    - For any `ChatMessage` where `isAdvocateMessage` returns `false`, the rendered output contains a badge element whose CSS classes match `USER_TYPE_COLORS[msg.userType]`
    - Use `fc.record({ userType: fc.constantFrom('VOLUNTEER','DONOR','STAFF'), senderName: fc.string().filter(s => s !== 'Community Advocate'), message: fc.string(), roomId: fc.string({ minLength: 1 }), timestamp: fc.date().map(d => d.toISOString()) })`
    - **Validates: Requirements 2.5**

- [x] 6. Property-based tests for mock data referential integrity and admin row rendering
  - [x] 6.1 Create `packages/dashboard/src/lib/mockData.pbt.test.ts`
    - Scaffold with vitest + fast-check + `@testing-library/react` imports
    - _Requirements: 3.3, 3.4, 4.2, 4.3_

  - [x] 6.2 Write property test for P5: mock data referential integrity
    - **Property 5: Mock data referential integrity**
    - For every `DonationRecord` in `MOCK_DONATIONS`, assert a `MockUser` exists with matching `userId` and that user's `donationIds` contains the `donationId`; conversely, for every `donationId` in any `MockUser.donationIds`, assert a `DonationRecord` exists with that `donationId`
    - Iterate over `MOCK_DONATIONS` and `MOCK_USERS` directly (no arbitrary needed — deterministic data)
    - **Validates: Requirements 3.3, 3.4**

  - [x] 6.3 Write property test for P6: admin member row rendering completeness
    - **Property 6: Member row rendering completeness**
    - For any `MockUser` sampled from `MOCK_USERS`, the rendered admin table row contains the user's full name, email, a badge with the correct color class for their `userType`, `activitySummary` text, and a formatted `joinedAt` date string
    - Use `fc.constantFrom(...MOCK_USERS)` as the arbitrary
    - **Validates: Requirements 4.2, 4.3**

- [x] 7. Checkpoint — all property tests passing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Unit tests for CommunityChat polling and submission
  - [x] 8.1 Create `packages/dashboard/src/components/CommunityChat.test.tsx`
    - Write unit tests using `@testing-library/react` and vitest fake timers
    - Cover: renders initial messages; polling calls GET every 3 s; polling interval cleared on unmount; silent error handling on poll failure; auto-scroll on new messages; send button disabled + "Sending…" during POST; anonymous fallback when senderName blank; immediate GET after successful POST
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [x] 9. Unit tests for advocate pledge notification failure handling
  - [x] 9.1 Create `packages/dashboard/src/app/api/advocate/advocate.test.ts`
    - Write unit tests for the non-fatal pledge notification path
    - Cover: `executeAlertTool` throwing does not cause `executePledgeTool` to throw; pledge notification uses `"Anonymous"` when `donorName` is absent; pledge notification defaults `quantity` to `1` when absent
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 10. Unit tests for admin page empty state and member rendering
  - [x] 10.1 Create `packages/dashboard/src/app/admin/page.test.tsx`
    - Write unit tests using `@testing-library/react`
    - Cover: renders all `MOCK_USERS` rows; shows member count subtitle; renders "No community members yet" empty state when `MOCK_USERS` is empty (mock the import); each row contains name, email, role badge, `activitySummary`, formatted `joinedAt`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

- [x] 11. Final checkpoint — all tests passing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Task 1 is the highest-impact runtime change — live pledges from the Advocate will not appear in chat until it is complete
- Property tests reference design document properties P1–P9 for traceability
- `fast-check` must be installed (task 2.1) before any property test tasks can run
- All test files use `vitest --run` (single-pass, no watch mode)
