# Requirements Document

## Introduction

ShelterLink enables real-time shelter capacity tracking via web form or SMS simulator updates from non-technical shelter staff, surfaced on a publicly accessible React dashboard. The system is designed for community volunteers, donors, and shelter managers operating under time pressure with varying levels of technical ability.

The architecture uses a Lambda Function URL as the public ingestion endpoint (replacing AWS Pinpoint, which requires sandbox approval). AWS AppSync provides real-time GraphQL subscriptions for Community Chat. DynamoDB stores shelter state, chat messages, and donation pledges across three tables.

## Glossary

- **System**: The ShelterLink platform as a whole
- **Ingestion_Endpoint**: The Lambda Function URL that receives HTTP POST updates from a web form or SMS simulator
- **Update_Processor**: The AWS Lambda function that parses inbound updates and writes shelter state to the database
- **Data_Store**: The AWS DynamoDB tables that persist shelter records, chat messages, and donation pledges
- **Dashboard**: The public-facing Next.js web application that displays shelter capacity, needs, inventory, and community chat
- **Shelter_Manager**: An authorized staff member who submits updates on behalf of a shelter
- **Volunteer**: A community member who reads the Dashboard to find shelters with capacity or needs
- **Donor**: A community member who pledges to bring supplies to a shelter
- **Needs_List**: A prioritized, filterable list of items or services a shelter is currently requesting
- **Capacity_Record**: A structured record containing a shelter's current bed count, occupancy, and status
- **Inventory**: A map of item names to quantities currently held by a shelter
- **Parser**: The component within Update_Processor responsible for interpreting raw update text into structured data
- **Pretty_Printer**: The component responsible for formatting structured shelter data back into human-readable confirmation messages
- **Community_Chat**: A real-time messaging channel per shelter, powered by AWS AppSync

---

## Requirements

### Requirement 1: Web Form / SMS Simulator Updates

**User Story:** As a Shelter_Manager, I want to submit a structured update via a web form or SMS simulator, so that I can keep the Dashboard accurate without a native SMS gateway.

#### Acceptance Criteria

1. WHEN the Ingestion_Endpoint receives a valid POST request from a registered phone number, THE Update_Processor SHALL parse the body and update the corresponding Capacity_Record in the Data_Store within 3 seconds.
2. WHEN the Ingestion_Endpoint receives a POST request from an unregistered phone number, THE endpoint SHALL return a 403 response explaining that the number is not authorized.
3. WHEN the Update_Processor successfully updates a Capacity_Record, THE endpoint SHALL return a JSON confirmation containing the parsed values that were stored.
4. IF the Parser cannot interpret the update body format, THEN THE endpoint SHALL return a 400 response with a descriptive error message and an example of the correct format.
5. THE Parser SHALL accept updates in a case-insensitive, whitespace-tolerant format to accommodate non-technical users.
6. FOR ALL valid update bodies, parsing the body then formatting the confirmation via Pretty_Printer then parsing the confirmation SHALL produce an equivalent Capacity_Record (round-trip property).
7. THE Ingestion_Endpoint SHALL enforce CORS, restricting allowed origins to the configured `ALLOWED_ORIGIN` value.

---

### Requirement 2: Real-Time Dashboard

**User Story:** As a Volunteer, I want to see a live dashboard of shelter capacity across my community, so that I can direct people to shelters that have space available.

#### Acceptance Criteria

1. THE Dashboard SHALL display all active shelters with their current Capacity_Record, including bed availability, occupancy percentage, and last-updated timestamp.
2. WHEN a Capacity_Record is updated in the Data_Store, THE Dashboard SHALL reflect the change within 5 seconds without requiring a manual page refresh.
3. WHILE a Dashboard client is connected, THE System SHALL push Capacity_Record updates to the client in real time using Server-Sent Events (SSE).
4. WHEN the Dashboard cannot reach the backend, THE Dashboard SHALL display a clearly visible stale-data warning indicating the time of the last successful update.
5. THE Dashboard SHALL render a usable view of all shelter data with JavaScript disabled, providing a server-rendered fallback.
6. THE Dashboard SHALL display shelter location, contact information, and current status on a single screen without requiring horizontal scrolling on viewports 320px wide and above.

---

### Requirement 3: Prioritized Needs List

**User Story:** As a Volunteer or Donor, I want to see a prioritized list of what each shelter currently needs, so that I can bring the most impactful supplies or services.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Needs_List for each shelter, ordered by priority level (Critical, High, Medium, Low) descending.
2. WHEN a Shelter_Manager submits an update containing needs items, THE Update_Processor SHALL parse each item with its priority level and store it in the Data_Store.
3. WHEN a Shelter_Manager omits a priority level for a needs item, THE Update_Processor SHALL assign a default priority of Medium.
4. THE Dashboard SHALL allow Volunteers to filter the Needs_List by priority level without a page reload.
5. WHEN a need is marked as fulfilled by a Shelter_Manager via update, THE Update_Processor SHALL remove the item from the active Needs_List and THE Dashboard SHALL reflect the removal within 5 seconds.
6. THE Needs_List SHALL display a "No current needs" message when a shelter's Needs_List is empty.

---

### Requirement 4: Inventory Management

**User Story:** As a Shelter_Manager, I want to update my shelter's current inventory of supplies, so that Donors can see what we already have and avoid duplicating donations.

#### Acceptance Criteria

1. THE Data_Store SHALL maintain an Inventory map per shelter record, storing item names and quantities.
2. WHEN a Shelter_Manager submits an inventory update via the admin panel, THE System SHALL update the Inventory map in the Data_Store using an atomic `UpdateItem` operation.
3. THE Dashboard SHALL display the current Inventory for each shelter on the shelter detail page.
4. WHEN an inventory item quantity is set to zero, THE Dashboard SHALL display it as "Out of stock" rather than hiding the item.
5. THE Inventory display SHALL be read-only for Volunteers and Donors; only authenticated admins may update inventory.

---

### Requirement 5: Community Chat

**User Story:** As a Volunteer or Donor, I want to send and receive real-time messages in a shelter's community channel, so that I can coordinate with other community members.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Community_Chat panel on each shelter detail page.
2. WHEN a community member sends a message, THE System SHALL persist it to the Data_Store and push it to all connected clients in that shelter's chat room within 2 seconds via AppSync subscription.
3. THE Community_Chat SHALL display the sender's name, user type (Volunteer / Donor / Staff), and timestamp for each message.
4. THE Community_Chat SHALL load the most recent 50 messages on page load.
5. THE Community_Chat SHALL display a "No messages yet" state when the room is empty.
6. Chat messages SHALL expire after 30 days via DynamoDB TTL.

---

### Requirement 6: Donation Tracking

**User Story:** As a Donor, I want to pledge specific supplies to a shelter and track whether my donation has been delivered, so that I can follow through on my commitment.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a donation pledge form on each shelter detail page, accessible without authentication.
2. WHEN a Donor submits a pledge, THE System SHALL write a Donation record to the Data_Store with status `PLEDGED` and return a confirmation.
3. THE Donation record SHALL include: donor identifier, shelter ID, list of items with quantities, pledge timestamp, and status.
4. THE admin panel SHALL display all pending pledges for each shelter, ordered by pledge date.
5. WHEN an admin marks a pledge as delivered, THE System SHALL update the Donation record status to `DELIVERED` and record the delivery timestamp.
6. A Donor SHALL be able to view their own pledge history using a session identifier or email.

---

### Requirement 7: Accessibility (WCAG 2.1 AA)

**User Story:** As an older adult or user with a disability, I want the Dashboard to be fully navigable and readable, so that I can access shelter information without barriers.

#### Acceptance Criteria

1. THE Dashboard SHALL meet WCAG 2.1 Level AA color contrast requirements, with a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text and UI components.
2. THE Dashboard SHALL be fully navigable using a keyboard alone, with visible focus indicators on all interactive elements.
3. THE Dashboard SHALL provide text alternatives for all non-text content, including status icons and capacity indicators.
4. WHEN the Dashboard displays a status change or real-time update, THE Dashboard SHALL announce the change to screen readers using an ARIA live region.
5. THE Dashboard SHALL not use color as the sole means of conveying shelter status; each status SHALL also be conveyed through a text label or icon with a text alternative.
6. THE Dashboard SHALL render all text at a minimum of 16px base font size and SHALL remain readable when the browser zoom level is set to 200%.

---

### Requirement 8: Shelter Registration and Authorization

**User Story:** As a system administrator, I want to control which phone numbers can submit updates, so that the Dashboard data cannot be corrupted by unauthorized senders.

#### Acceptance Criteria

1. THE System SHALL maintain a registry of authorized phone numbers mapped to shelter identities in the Data_Store.
2. WHEN an inbound update is received, THE Update_Processor SHALL verify the sender's phone number against the registry before processing any update.
3. IF an unauthorized update attempt is made more than 5 times from the same number within 10 minutes, THEN THE System SHALL suppress further responses to that number for 60 minutes.
4. THE System SHALL log all inbound update attempts, including unauthorized ones, with a timestamp and masked phone number for audit purposes.
5. WHERE an administrative interface is provided, THE System SHALL require authenticated access before allowing changes to the shelter registry or inventory.

---

### Requirement 9: Region Configuration

**User Story:** As a developer deploying ShelterLink, I want all AWS SDK clients to use an explicit region, so that deployments do not silently fail due to region misconfiguration.

#### Acceptance Criteria

1. ALL DynamoDB, AppSync, and Lambda SDK client instantiations SHALL include `region: process.env['AWS_REGION'] ?? 'us-east-1'`.
2. THE CDK stack SHALL explicitly set `env: { region: 'us-east-1' }` on the stack definition.
3. THE dashboard `.env.local` SHALL include `AWS_REGION=us-east-1` as a required variable.
4. IF `AWS_REGION` is not set, THE System SHALL default to `us-east-1` and log a warning at startup.
