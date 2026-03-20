# Requirements Document

## Introduction

SMS Broadcast Alerts adds outbound SMS notifications to ShelterLink. When a shelter reaches a critical state — such as going FULL or CLOSED, or flagging a CRITICAL-priority supply need — AWS Pinpoint sends SMS messages to subscribed volunteers and donors. This closes the loop on the existing inbound-only SMS path: Pinpoint is already wired in CDK (CfnApp + CfnSMSChannel + IAM + SSM params), and the Lambda `sendSms()` helper is in place. This feature adds the subscription management layer, the broadcast trigger logic, and the opt-in/opt-out mechanics.

## Glossary

- **Broadcast_Service**: The module responsible for evaluating shelter state changes and dispatching outbound SMS via Pinpoint.
- **Subscriber**: A volunteer or donor who has opted in to receive SMS alerts for one or more shelters.
- **Subscription_Store**: The DynamoDB `shelterlink-data` table records that persist subscriber phone numbers and their shelter preferences.
- **Alert_Trigger**: A shelter state change that qualifies for broadcast — status transitions to FULL or CLOSED, or a new CRITICAL-priority need appearing in the needs list.
- **Update_Processor**: The existing Lambda handler (`packages/lambda/src/handler.ts`) that processes inbound SMS updates.
- **Stream_Handler**: The existing Lambda (`packages/lambda/src/streamHandler.ts`) triggered by DynamoDB Streams on `shelterlink-data`.
- **Pinpoint**: AWS Pinpoint, used as the SMS delivery channel. App ID and origination number are stored in SSM and injected as Lambda env vars.
- **Opt_In_API**: The Next.js API route that registers a subscriber's phone number and shelter preferences.
- **Opt_Out_API**: The Next.js API route (or inbound SMS keyword handler) that removes a subscriber's phone number.
- **E.164**: The international phone number format required by Pinpoint (e.g. `+12025551234`).
- **Suppression_Window**: The period during which a subscriber who replied STOP will not receive any further messages.

---

## Requirements

### Requirement 1: Subscriber Opt-In

**User Story:** As a volunteer or donor, I want to subscribe to SMS alerts for specific shelters, so that I am notified when those shelters reach a critical state.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/alerts/subscribe` with a valid E.164 phone number and at least one shelter ID, THE Opt_In_API SHALL create a subscription record in the Subscription_Store.
2. THE Opt_In_API SHALL validate that the phone number conforms to E.164 format before writing to the Subscription_Store.
3. IF the phone number does not conform to E.164 format, THEN THE Opt_In_API SHALL return HTTP 400 with a descriptive error message.
4. IF a subscription record already exists for the given phone number and shelter ID pair, THEN THE Opt_In_API SHALL return HTTP 200 without creating a duplicate record.
5. THE Opt_In_API SHALL store the subscription with a `status` of `ACTIVE` and a `subscribedAt` ISO 8601 timestamp.
6. THE Opt_In_API SHALL NOT require authentication — any visitor may subscribe.
7. WHEN a subscription is created, THE Opt_In_API SHALL send a confirmation SMS to the subscriber's phone number via Pinpoint acknowledging the opt-in.

---

### Requirement 2: Subscriber Opt-Out

**User Story:** As a subscriber, I want to unsubscribe from SMS alerts, so that I stop receiving messages I no longer want.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/alerts/unsubscribe` with a valid E.164 phone number, THE Opt_Out_API SHALL set the `status` of all matching subscription records to `UNSUBSCRIBED`.
2. WHEN an inbound SMS message body contains only the keyword `STOP` (case-insensitive), THE Update_Processor SHALL set the `status` of all subscription records for that phone number to `UNSUBSCRIBED`.
3. WHEN an inbound SMS message body contains only the keyword `START` (case-insensitive), THE Update_Processor SHALL set the `status` of all subscription records for that phone number back to `ACTIVE`.
4. IF no subscription record exists for the given phone number, THEN THE Opt_Out_API SHALL return HTTP 200 without error.
5. WHILE a subscriber's status is `UNSUBSCRIBED`, THE Broadcast_Service SHALL NOT send any SMS messages to that phone number.
6. WHEN a subscriber opts out via STOP keyword, THE Update_Processor SHALL send a single confirmation SMS acknowledging the opt-out before suppressing further messages.

---

### Requirement 3: Alert Trigger Conditions

**User Story:** As a shelter administrator, I want alerts to fire automatically when my shelter hits a critical state, so that volunteers and donors are notified without manual intervention.

#### Acceptance Criteria

1. WHEN a shelter's `status` transitions to `FULL` and the previous `status` was not `FULL`, THE Broadcast_Service SHALL dispatch an alert SMS to all ACTIVE subscribers for that shelter.
2. WHEN a shelter's `status` transitions to `CLOSED` and the previous `status` was not `CLOSED`, THE Broadcast_Service SHALL dispatch an alert SMS to all ACTIVE subscribers for that shelter.
3. WHEN a shelter update introduces a new needs item with `priority` equal to `CRITICAL` that was not present in the previous record, THE Broadcast_Service SHALL dispatch an alert SMS to all ACTIVE subscribers for that shelter.
4. WHEN a shelter's `status` transitions from `FULL` or `CLOSED` back to `OPEN`, THE Broadcast_Service SHALL dispatch a recovery alert SMS to all ACTIVE subscribers for that shelter.
5. THE Broadcast_Service SHALL evaluate trigger conditions by comparing the `NEW_IMAGE` and `OLD_IMAGE` from the DynamoDB Streams event — no additional DynamoDB reads are required for trigger evaluation.
6. IF a shelter update does not meet any trigger condition, THEN THE Broadcast_Service SHALL NOT send any SMS messages for that update.

---

### Requirement 4: Alert Message Content

**User Story:** As a subscriber, I want alert messages to be clear and actionable, so that I know exactly what is happening and what I can do.

#### Acceptance Criteria

1. THE Broadcast_Service SHALL format FULL status alert messages as: `ShelterLink Alert: [Shelter Name] is now FULL ([beds]/[capacity] beds). Reply STOP to unsubscribe.`
2. THE Broadcast_Service SHALL format CLOSED status alert messages as: `ShelterLink Alert: [Shelter Name] is now CLOSED. Reply STOP to unsubscribe.`
3. THE Broadcast_Service SHALL format OPEN recovery alert messages as: `ShelterLink Alert: [Shelter Name] has reopened — [beds]/[capacity] beds available. Reply STOP to unsubscribe.`
4. THE Broadcast_Service SHALL format CRITICAL needs alert messages as: `ShelterLink Alert: [Shelter Name] urgently needs [item]. Reply STOP to unsubscribe.`
5. WHEN multiple CRITICAL needs items are introduced in a single update, THE Broadcast_Service SHALL send a single SMS listing all new CRITICAL items rather than one SMS per item.
6. THE Broadcast_Service SHALL ensure all outbound SMS messages are 160 characters or fewer to avoid multi-part message splitting.
7. IF a formatted message exceeds 160 characters, THEN THE Broadcast_Service SHALL truncate the shelter name to fit within the 160-character limit while preserving the opt-out instruction.

---

### Requirement 5: Broadcast Delivery via Pinpoint

**User Story:** As a system operator, I want broadcasts to use the existing Pinpoint channel, so that outbound SMS delivery is consistent with the inbound infrastructure.

#### Acceptance Criteria

1. THE Broadcast_Service SHALL use the `PINPOINT_APP_ID` environment variable to identify the Pinpoint application when calling `SendMessagesCommand`.
2. THE Broadcast_Service SHALL use the `ORIGINATION_NUMBER` environment variable as the sender number for all outbound broadcast SMS messages.
3. THE Broadcast_Service SHALL use `new PinpointClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })` for all Pinpoint API calls.
4. IF `PINPOINT_APP_ID` is absent or equal to `PENDING`, THEN THE Broadcast_Service SHALL log the skipped broadcast at INFO level and return without error.
5. IF a Pinpoint `SendMessagesCommand` call returns a delivery failure for a specific phone number, THEN THE Broadcast_Service SHALL log the failure at WARN level including the masked phone number and continue processing remaining subscribers.
6. THE Broadcast_Service SHALL NOT throw an unhandled exception when a single subscriber's SMS delivery fails — partial delivery is acceptable.

---

### Requirement 6: Subscription Data Model

**User Story:** As a system operator, I want subscription records stored in the existing single-table design, so that no new DynamoDB tables are required.

#### Acceptance Criteria

1. THE Subscription_Store SHALL store each subscription as a DynamoDB item with `PK=SUBSCRIBER#<hashedPhone>` and `SK=SHELTER#<shelterId>`.
2. THE Subscription_Store SHALL store the following attributes on each subscription item: `phone` (E.164, encrypted or hashed for storage), `shelterId`, `status` (`ACTIVE` or `UNSUBSCRIBED`), `subscribedAt` (ISO 8601), and `updatedAt` (ISO 8601).
3. THE Subscription_Store SHALL use a Global Secondary Index with `PK=shelterId` and `SK=status` to enable efficient fan-out queries — retrieving all ACTIVE subscribers for a given shelter.
4. THE Subscription_Store SHALL store the raw E.164 phone number as an attribute (not as a key) so that Pinpoint can use it for delivery, while the DynamoDB key uses the SHA-256 hash.
5. THE Subscription_Store SHALL NOT apply a TTL to subscription records — subscriptions persist until explicitly unsubscribed.

---

### Requirement 7: Broadcast Fan-Out Integration

**User Story:** As a system operator, I want broadcasts triggered by the existing DynamoDB Streams pipeline, so that no new event sources or polling mechanisms are needed.

#### Acceptance Criteria

1. THE Stream_Handler SHALL evaluate Alert_Trigger conditions for each `MODIFY` event on items with `SK=RECORD#CURRENT`.
2. WHEN an Alert_Trigger condition is met, THE Stream_Handler SHALL query the Subscription_Store GSI for all ACTIVE subscribers for the affected shelter.
3. THE Stream_Handler SHALL invoke the Broadcast_Service for each batch of ACTIVE subscribers returned by the GSI query.
4. THE Stream_Handler SHALL process all DynamoDB Streams records in a batch before returning — partial batch failures SHALL be reported via `batchItemFailures`.
5. IF the Subscription_Store GSI query returns zero ACTIVE subscribers, THEN THE Stream_Handler SHALL log at INFO level and skip broadcast without error.

---

### Requirement 8: Dashboard Subscription UI

**User Story:** As a volunteer or donor browsing the dashboard, I want to subscribe to alerts for a shelter directly from the shelter detail page, so that I do not need to use a separate interface.

#### Acceptance Criteria

1. THE Dashboard SHALL display a subscription form on each shelter detail page (`/shelter/[id]`) containing a phone number input field and a subscribe button.
2. WHEN a user submits the subscription form with a valid E.164 phone number, THE Dashboard SHALL call the Opt_In_API and display a success message confirming the subscription.
3. IF the Opt_In_API returns an error, THEN THE Dashboard SHALL display the error message returned by the API without exposing internal details.
4. THE Dashboard SHALL display an unsubscribe option that calls the Opt_Out_API when activated.
5. THE Dashboard SHALL validate the phone number input on the client side before submitting — the input SHALL accept only digits, spaces, dashes, parentheses, and a leading `+`.
6. THE Dashboard SHALL normalize the phone number to E.164 format before sending it to the Opt_In_API.

---

### Requirement 9: Privacy and Security

**User Story:** As a subscriber, I want my phone number handled securely, so that it is not exposed in logs or accessible to unauthorized parties.

#### Acceptance Criteria

1. THE Broadcast_Service SHALL use `maskPhone()` on all log entries that reference a subscriber's phone number — raw E.164 numbers SHALL NOT appear in CloudWatch logs.
2. THE Subscription_Store SHALL use the SHA-256 hash of the phone number as the DynamoDB partition key — the raw phone number SHALL NOT be used as a DynamoDB key.
3. THE Opt_In_API SHALL NOT return subscriber phone numbers in any API response.
4. THE Opt_Out_API SHALL NOT require authentication — any caller with the phone number may unsubscribe.
5. THE Broadcast_Service SHALL NOT log the full list of subscriber phone numbers at any log level.

---

### Requirement 10: Observability

**User Story:** As a system operator, I want broadcast activity logged and measurable, so that I can detect delivery failures and monitor subscription growth.

#### Acceptance Criteria

1. THE Broadcast_Service SHALL log a structured INFO event for each successful broadcast dispatch including: `shelterId`, `triggerType` (`STATUS_FULL`, `STATUS_CLOSED`, `STATUS_OPEN`, `CRITICAL_NEED`), and `recipientCount`.
2. THE Broadcast_Service SHALL log a structured WARN event for each failed individual delivery including: `shelterId`, `triggerType`, and `maskedPhone`.
3. THE Stream_Handler SHALL log a structured INFO event when a trigger condition is evaluated but no subscribers are found, including `shelterId` and `triggerType`.
4. THE Opt_In_API SHALL log a structured INFO event for each new subscription created, including `shelterId` and `maskedPhone`.
5. THE Opt_Out_API SHALL log a structured INFO event for each unsubscription, including `maskedPhone`.
