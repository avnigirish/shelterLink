# Requirements Document

## Introduction

ShelterLink enables real-time shelter capacity tracking via SMS updates from non-technical shelter staff, surfaced on a publicly accessible React dashboard. The system is designed for community volunteers, donors, and shelter managers operating under time pressure with varying levels of technical ability.

## Glossary

- **System**: The ShelterLink platform as a whole
- **SMS_Gateway**: The AWS Pinpoint service that receives and sends SMS messages
- **Update_Processor**: The AWS Lambda function that parses inbound SMS messages and writes shelter state to the database
- **Data_Store**: The AWS DynamoDB table that persists shelter records
- **Dashboard**: The public-facing Next.js web application that displays shelter capacity and needs
- **Shelter_Manager**: An authorized staff member who sends SMS updates on behalf of a shelter
- **Volunteer**: A community member who reads the Dashboard to find shelters with capacity or needs
- **Needs_List**: A prioritized, filterable list of items or services a shelter is currently requesting
- **Capacity_Record**: A structured record containing a shelter's current bed count, occupancy, and status
- **Parser**: The component within Update_Processor responsible for interpreting raw SMS text into structured data
- **Pretty_Printer**: The component responsible for formatting structured shelter data back into human-readable SMS confirmation messages

---

## Requirements

### Requirement 1: SMS-Based Capacity Updates

**User Story:** As a Shelter_Manager, I want to send a simple SMS to update my shelter's capacity and status, so that I can keep the Dashboard accurate without logging into any system.

#### Acceptance Criteria

1. WHEN the SMS_Gateway receives an inbound SMS from a registered phone number, THE Update_Processor SHALL parse the message and update the corresponding Capacity_Record in the Data_Store within 3 seconds.
2. WHEN the SMS_Gateway receives an inbound SMS from an unregistered phone number, THE SMS_Gateway SHALL reply with a message explaining that the number is not authorized and providing a registration contact.
3. WHEN the Update_Processor successfully updates a Capacity_Record, THE SMS_Gateway SHALL send a confirmation SMS to the originating number containing the parsed values that were stored.
4. IF the Parser cannot interpret the inbound SMS format, THEN THE SMS_Gateway SHALL reply with a descriptive error message and an example of the correct format.
5. THE Parser SHALL accept updates in a case-insensitive, whitespace-tolerant format to accommodate non-technical users.
6. FOR ALL valid inbound SMS messages, parsing the message then formatting the confirmation via Pretty_Printer then parsing the confirmation SHALL produce an equivalent Capacity_Record (round-trip property).

---

### Requirement 2: Real-Time Dashboard

**User Story:** As a Volunteer, I want to see a live dashboard of shelter capacity across my community, so that I can direct people to shelters that have space available.

#### Acceptance Criteria

1. THE Dashboard SHALL display all active shelters with their current Capacity_Record, including bed availability, occupancy percentage, and last-updated timestamp.
2. WHEN a Capacity_Record is updated in the Data_Store, THE Dashboard SHALL reflect the change within 5 seconds without requiring a manual page refresh.
3. WHILE a Dashboard client is connected, THE System SHALL push Capacity_Record updates to the client in real time using server-sent events or WebSocket.
4. WHEN the Dashboard cannot reach the backend, THE Dashboard SHALL display a clearly visible stale-data warning indicating the time of the last successful update.
5. THE Dashboard SHALL render a usable view of all shelter data with JavaScript disabled, providing a server-rendered fallback.
6. THE Dashboard SHALL display shelter location, contact information, and current status on a single screen without requiring horizontal scrolling on viewports 320px wide and above.

---

### Requirement 3: Prioritized Needs List

**User Story:** As a Volunteer or donor, I want to see a prioritized list of what each shelter currently needs, so that I can bring the most impactful supplies or services.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Needs_List for each shelter, ordered by priority level (Critical, High, Medium, Low) descending.
2. WHEN a Shelter_Manager sends an SMS update containing needs items, THE Update_Processor SHALL parse each item with its priority level and store it in the Data_Store as part of the shelter's record.
3. WHEN a Shelter_Manager omits a priority level for a needs item in their SMS, THE Update_Processor SHALL assign a default priority of Medium.
4. THE Dashboard SHALL allow Volunteers to filter the Needs_List by priority level without a page reload.
5. WHEN a need is marked as fulfilled by a Shelter_Manager via SMS, THE Update_Processor SHALL remove the item from the active Needs_List and THE Dashboard SHALL reflect the removal within 5 seconds.
6. THE Needs_List SHALL display a "No current needs" message when a shelter's Needs_List is empty, rather than an empty or blank section.

---

### Requirement 4: Accessibility (WCAG 2.1 AA)

**User Story:** As an older adult or user with a disability, I want the Dashboard to be fully navigable and readable, so that I can access shelter information without barriers.

#### Acceptance Criteria

1. THE Dashboard SHALL meet WCAG 2.1 Level AA color contrast requirements, with a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text and UI components.
2. THE Dashboard SHALL be fully navigable using a keyboard alone, with visible focus indicators on all interactive elements.
3. THE Dashboard SHALL provide text alternatives for all non-text content, including status icons and capacity indicators.
4. WHEN the Dashboard displays a status change or real-time update, THE Dashboard SHALL announce the change to screen readers using an ARIA live region.
5. THE Dashboard SHALL not use color as the sole means of conveying shelter status; each status SHALL also be conveyed through a text label or icon with a text alternative.
6. THE Dashboard SHALL render all text at a minimum of 16px base font size and SHALL remain readable when the browser zoom level is set to 200%.

---

### Requirement 5: Shelter Registration and Authorization

**User Story:** As a system administrator, I want to control which phone numbers can submit updates, so that the Dashboard data cannot be corrupted by unauthorized senders.

#### Acceptance Criteria

1. THE System SHALL maintain a registry of authorized phone numbers mapped to shelter identities in the Data_Store.
2. WHEN an inbound SMS is received, THE Update_Processor SHALL verify the sender's phone number against the registry before processing any update.
3. IF an unauthorized update attempt is made more than 5 times from the same number within 10 minutes, THEN THE System SHALL suppress further replies to that number for 60 minutes to prevent SMS reply abuse.
4. THE System SHALL log all inbound SMS attempts, including unauthorized ones, with a timestamp and masked phone number for audit purposes.
5. WHERE an administrative interface is provided, THE System SHALL require authenticated access before allowing changes to the shelter registry.
