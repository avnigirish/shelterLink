# Requirements Document

## Introduction

The Community Activity Feed feature enhances ShelterLink's real-time community experience by surfacing donation and pledge events directly in the community chat interface, populating the platform with realistic mock community members, and giving admins a rich view of each member's activity and donation history. It also standardizes the admin UI to use the same dark-mode design token system used across all main pages.

The feature has four distinct areas:
1. Pledge/donation events auto-posted to community chat by the Advocate agent
2. Mock community users with realistic names, roles, and donation history
3. Admin page showing community members with linked donation records and inventory interactions
4. Admin UI consistency — no raw Tailwind color classes; all surfaces use design tokens

---

## Glossary

- **Activity_Feed**: The community chat interface (`CommunityChat` component) that displays real-time messages per shelter room
- **Advocate**: The AI agent (`AdvocateChat` component + `/api/advocate` route) that can call `PledgeTool` and `AlertTool` on behalf of users
- **AlertTool**: The Advocate's tool that posts a coordination message to a shelter's community chat room
- **PledgeTool**: The Advocate's tool that creates a `DonationRecord` for a specific shelter and item
- **Pledge_Notification**: A chat message automatically posted to the Activity_Feed when `PledgeTool` fires, formatted as `🤝 <donorName> has pledged to donate <qty>× <item>`
- **Community_Member**: A user profile stored in `mockUsers.ts` with fields: `userId`, `name`, `email`, `userType`, `joinedAt`, `activitySummary`, `donationIds`
- **DonationRecord**: The type defined in `shelter.ts` representing a single donation pledge with `userId`, `donationId`, `shelterId`, `shelterName`, `donorName`, `donorEmail`, `items`, `status`, `pledgedAt`, `deliveredAt?`
- **Admin_Page**: The authenticated Next.js page at `/admin` rendered by `packages/dashboard/src/app/admin/page.tsx`
- **Design_Token**: A Tailwind CSS utility class from the project's custom token set (e.g. `bg-surface-DEFAULT`, `dark:bg-dark-surface`, `text-text-DEFAULT`, `dark:text-dark-text`) as opposed to raw Tailwind color classes like `bg-white` or `bg-gray-50`
- **Mock_Mode**: The application state when `USE_MOCK_DATA=true`, where all data is served from in-memory mock files instead of DynamoDB
- **UserType**: The discriminated union `'VOLUNTEER' | 'DONOR' | 'STAFF' | 'ADMIN'` defined in `shelter.ts`
- **ChatMessage**: The type `{ roomId, timestamp, senderName, message, userType }` defined in `shelter.ts`

---

## Requirements

### Requirement 1: Pledge Notifications Auto-Posted to Community Chat

**User Story:** As a community member viewing the shelter chat, I want to see pledge events appear automatically when the Advocate agent processes a donation, so that I can feel the community's generosity in real time without any manual action.

#### Acceptance Criteria

1. WHEN `PledgeTool` completes successfully, THE Advocate SHALL post a `ChatMessage` to the shelter's Activity_Feed with `senderName` set to `"Community Advocate"`, `userType` set to `"ADMIN"`, and `message` formatted as `🤝 <donorName> has pledged to donate <qty>× <item>`
2. WHEN `donorName` is not provided or is empty, THE Advocate SHALL substitute `"Anonymous"` in the Pledge_Notification message
3. WHEN `quantity` is not provided, THE Advocate SHALL default to `1` in the Pledge_Notification message
4. IF the AlertTool call that posts the Pledge_Notification fails, THEN THE Advocate SHALL still return a successful pledge confirmation to the user — the notification failure SHALL NOT cause the pledge to fail
5. THE Activity_Feed SHALL display the Pledge_Notification within one polling cycle (≤ 3 seconds) of it being written to the mock message store
6. WHEN `USE_MOCK_DATA` is `true`, THE Advocate SHALL write the Pledge_Notification to the in-memory `MOCK_MESSAGES` array in `chat/[shelterId]/route.ts` so it is immediately visible to polling clients

### Requirement 2: Visual Treatment of Pledge Notifications in Chat

**User Story:** As a community member, I want pledge notifications to stand out visually from regular chat messages, so that I can immediately recognize when a donation has been committed.

#### Acceptance Criteria

1. WHEN a `ChatMessage` has `senderName === "Community Advocate"` and `userType === "ADMIN"`, THE Activity_Feed SHALL render that message with a teal background highlight (`bg-teal-50 dark:bg-teal-900/10`)
2. THE Activity_Feed SHALL render the sender name of a Pledge_Notification in teal text (`text-teal-700 dark:text-teal-300`) rather than the default text color
3. THE Activity_Feed SHALL render the message body of a Pledge_Notification in teal text (`text-teal-800 dark:text-teal-200`) with `font-medium` weight
4. THE Activity_Feed SHALL NOT render a `UserType` badge for Pledge_Notifications — the teal styling serves as the visual indicator
5. WHEN a non-Pledge_Notification message is rendered, THE Activity_Feed SHALL render a colored `UserType` badge using the existing `USER_TYPE_COLORS` mapping

### Requirement 3: Mock Community Members

**User Story:** As a visitor or admin, I want to see a realistic set of community members with names, roles, and activity, so that the platform feels like a living community rather than an empty demo.

#### Acceptance Criteria

1. THE System SHALL maintain at least 8 `Community_Member` profiles in `mockUsers.ts`, each with a unique `userId`, realistic full name, email, `userType` (`VOLUNTEER`, `DONOR`, or `STAFF`), `joinedAt` timestamp, `activitySummary` string, and `donationIds` array
2. THE System SHALL include at least one `Community_Member` of each `userType`: `VOLUNTEER`, `DONOR`, and `STAFF`
3. WHEN a `DonationRecord` references a `userId`, THE System SHALL have a corresponding `Community_Member` in `mockUsers.ts` with a matching `userId`
4. THE System SHALL ensure every `donationId` listed in a `Community_Member`'s `donationIds` array corresponds to an existing `DonationRecord` in `mockDonations.ts`
5. THE `activitySummary` field of each `Community_Member` SHALL accurately reflect the items and shelter referenced in that member's linked `DonationRecord` entries

### Requirement 4: Admin Community Members View

**User Story:** As an admin, I want to see all community members on the admin page with their donation history and inventory interactions, so that I can understand who is contributing and what they have pledged or delivered.

#### Acceptance Criteria

1. THE Admin_Page SHALL render a "Community Members" section listing all entries from `MOCK_USERS`
2. WHEN rendering a `Community_Member` row, THE Admin_Page SHALL display: full name, email, `userType` badge, `activitySummary`, and formatted `joinedAt` date
3. THE Admin_Page SHALL render a `userType` badge for each `Community_Member` using the same color mapping used for donation status badges — `VOLUNTEER` in green, `DONOR` in blue, `STAFF` in purple — using Design_Tokens only
4. WHEN a `Community_Member` has one or more entries in `donationIds`, THE Admin_Page SHALL display the linked donation items and statuses inline or in an expandable sub-row
5. THE Admin_Page SHALL show the total member count as a subtitle next to the "Community Members" heading
6. IF `MOCK_USERS` is empty, THEN THE Admin_Page SHALL render a "No community members yet" empty state message

### Requirement 5: Admin UI Design Token Consistency

**User Story:** As an admin, I want the admin page to use the same visual design as the main public pages, so that the experience feels cohesive and dark mode works correctly throughout.

#### Acceptance Criteria

1. THE Admin_Page SHALL use only Design_Tokens for all surface backgrounds — no raw Tailwind classes such as `bg-white`, `bg-gray-50`, `bg-gray-100`, or `bg-gray-800` SHALL appear in `admin/page.tsx` or `admin/layout.tsx`
2. THE Admin_Page SHALL use only Design_Tokens for all text colors — no raw classes such as `text-gray-900`, `text-gray-600`, or `text-gray-400` SHALL appear in admin page or layout files
3. THE Admin_Page SHALL use only Design_Tokens for all border colors — no raw classes such as `border-gray-200` or `divide-gray-100` SHALL appear in admin page or layout files
4. WHEN the user's system preference is dark mode, THE Admin_Page SHALL render all surfaces, text, and borders using the `dark:` variant of the corresponding Design_Token, matching the visual style of the shelter detail and home pages
5. THE Admin_Page table headers SHALL use `bg-surface-muted dark:bg-dark-elevated` for their background, consistent with other data tables in the application
6. THE Admin_Page SHALL use `rounded-lg overflow-hidden` card containers with `border border-surface-border dark:border-dark-border` for all data sections, consistent with the `CommunityChat` and `InventoryPanel` components

### Requirement 6: Real-Time Chat Polling

**User Story:** As a community member, I want the chat to refresh automatically so I see new pledge notifications and messages without reloading the page.

#### Acceptance Criteria

1. THE Activity_Feed SHALL poll `GET /api/chat/[shelterId]` at a fixed interval of 3000 milliseconds while the component is mounted
2. WHEN the component unmounts, THE Activity_Feed SHALL cancel the polling interval to prevent memory leaks
3. IF a polling request fails, THEN THE Activity_Feed SHALL silently ignore the error and retry on the next interval — no error message SHALL be shown to the user for transient poll failures
4. WHEN new messages are received from a poll, THE Activity_Feed SHALL scroll to the bottom of the message list automatically
5. THE `GET /api/chat/[shelterId]` endpoint SHALL return messages filtered to the requested `shelterId` only — messages from other shelter rooms SHALL NOT appear

### Requirement 7: Chat Message Submission

**User Story:** As a community member, I want to post messages to the shelter chat under my name and role, so that I can coordinate with other volunteers and donors.

#### Acceptance Criteria

1. WHEN a user submits the chat form with a non-empty message, THE Activity_Feed SHALL POST the message to `/api/chat/[shelterId]` with `senderName`, `message`, and `userType` fields
2. WHEN `senderName` is left blank, THE Activity_Feed SHALL send `"Anonymous"` as the `senderName`
3. WHEN the POST request completes, THE Activity_Feed SHALL immediately fetch the latest messages and update the displayed list
4. WHILE a message is being sent, THE Activity_Feed SHALL disable the send button and display "Sending…" label
5. THE `POST /api/chat/[shelterId]` endpoint SHALL reject requests with a missing or empty `message` field with HTTP 400 and an `{ error: "Missing message" }` response body
6. THE `POST /api/chat/[shelterId]` endpoint SHALL accept `userType` values of `"VOLUNTEER"`, `"DONOR"`, or `"STAFF"` only — any other value SHALL be coerced to `"VOLUNTEER"`
