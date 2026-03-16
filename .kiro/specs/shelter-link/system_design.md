# System Design — ShelterLink

## Architecture Overview

ShelterLink uses a fully serverless, event-driven architecture on AWS. There is no server to manage or scale manually. The critical path is:

```
Shelter Manager (SMS)
  → AWS Pinpoint (SMS_Gateway)
  → AWS Lambda (Update_Processor)
  → AWS DynamoDB (Data_Store)
  → Next.js on Vercel / AWS Amplify (Dashboard)
  → Volunteer / Donor (Browser)
```

---

## Component Design

### 1. SMS_Gateway — AWS Pinpoint

- Receives inbound SMS on a dedicated long code or toll-free number
- Triggers the Update_Processor Lambda via SNS topic subscription
- Sends outbound confirmation and error reply SMS via Pinpoint API called from Lambda
- Phone number registration is stored in DynamoDB; no Pinpoint-side allow-listing required

### 2. Update_Processor — AWS Lambda (TypeScript)

- Runtime: Node.js 20.x, TypeScript compiled via esbuild
- Triggered by SNS message from Pinpoint inbound SMS event
- Responsibilities:
  - Validate sender phone number against the shelter registry
  - Parse SMS body using the Parser module
  - Write or update the Capacity_Record and Needs_List in DynamoDB
  - Publish a change event to an API Gateway WebSocket connection table or EventBridge
  - Call Pinpoint to send confirmation or error reply SMS via Pretty_Printer
- Environment variables: `SHELTER_TABLE`, `PINPOINT_APP_ID`, `ORIGINATION_NUMBER`
- IAM role: least-privilege, scoped to specific DynamoDB table and Pinpoint app

### 3. Data_Store — AWS DynamoDB

- Single-table design
- Partition key: `PK` (e.g., `SHELTER#<shelterId>`)
- Sort key: `SK` (e.g., `RECORD#CURRENT` for live state, `LOG#<timestamp>` for audit trail)
- Key attributes per shelter record:
  - `shelterId`, `name`, `address`, `phone`, `beds`, `occupancy`, `status`, `needsList`, `updatedAt`
- TTL on log entries: 90 days
- DynamoDB Streams enabled to trigger real-time push to connected Dashboard clients

### 4. Dashboard — Next.js (TypeScript)

- Hosted on Vercel or AWS Amplify
- Pages:
  - `/` — public shelter map and capacity list (SSR + client hydration)
  - `/shelter/[id]` — individual shelter detail with Needs_List
  - `/admin` — protected shelter registry management (NextAuth.js session required)
- Real-time updates via API Route that proxies DynamoDB Stream events as Server-Sent Events (SSE)
- Server-rendered fallback ensures content is accessible without JavaScript
- Styling: Tailwind CSS with WCAG 2.1 AA compliant color tokens

---

## Data Flow

### Inbound SMS Update

1. Shelter_Manager sends SMS: `BEDS 12/20 NEEDS blankets:high, water:critical`
2. Pinpoint receives SMS, publishes to SNS topic `shelterlink-inbound`
3. Lambda `Update_Processor` is invoked with SNS event payload
4. Lambda validates sender phone → looks up shelter in DynamoDB
5. Parser extracts `beds=12`, `capacity=20`, `needs=[{item:'blankets',priority:'HIGH'},{item:'water',priority:'CRITICAL'}]`
6. Lambda writes updated Capacity_Record to DynamoDB (`PK=SHELTER#abc`, `SK=RECORD#CURRENT`)
7. Lambda writes audit log entry (`SK=LOG#<timestamp>`)
8. DynamoDB Stream triggers SSE push Lambda → connected Dashboard clients receive update
9. Pretty_Printer formats confirmation: `Updated: 12/20 beds. Needs: blankets (HIGH), water (CRITICAL).`
10. Lambda calls Pinpoint to send confirmation SMS to Shelter_Manager

### Dashboard Load

1. Browser requests `/` — Next.js SSR fetches all shelters from DynamoDB and renders HTML
2. Client hydrates and opens SSE connection to `/api/updates`
3. On DynamoDB Stream event, SSE endpoint pushes JSON patch to all connected clients
4. React state updates, Dashboard re-renders affected shelter cards without full reload

---

## Scalability

- Lambda scales to zero when idle; no cost during off-hours
- DynamoDB on-demand billing handles traffic spikes (disaster events) without pre-provisioning
- SSE connections are stateless per Lambda invocation; connection state managed via DynamoDB connection table
- Pinpoint SMS throughput: up to 20 TPS on long code; sufficient for community-scale shelter networks

---

## Security

### Input Validation
- All SMS body content is treated as untrusted input
- Parser uses strict regex patterns; any unmatched content is rejected with an error reply
- DynamoDB writes use typed attribute schemas; no raw string interpolation into queries

### CSRF Protection
- Admin routes protected by NextAuth.js CSRF token validation on all POST/PUT/DELETE requests
- API routes validate `Origin` header against allowed domain list

### Authorization
- Shelter registry updates require an authenticated admin session (NextAuth.js + AWS Cognito or GitHub OAuth)
- Lambda execution role uses least-privilege IAM policy — no `*` resource ARNs
- DynamoDB table has resource-based policy restricting access to the Lambda execution role ARN

### Data Privacy
- Phone numbers stored in DynamoDB are hashed (SHA-256 + salt) in audit log entries
- Live registry stores E.164 format numbers; access restricted to Lambda role only

---

## AWS Well-Architected Alignment

| Pillar | Implementation |
|---|---|
| Operational Excellence | CloudWatch alarms on Lambda errors and DynamoDB throttles; structured JSON logging |
| Security | Least-privilege IAM, input validation, CSRF protection, phone number masking in logs |
| Reliability | DynamoDB on-demand, Lambda retries on SNS, SSR fallback for Dashboard |
| Performance Efficiency | Single-table DynamoDB design, SSE over polling, esbuild Lambda bundles |
| Cost Optimization | Serverless pay-per-use, DynamoDB TTL on logs, no idle EC2 |
| Sustainability | No always-on compute; Lambda cold starts acceptable for SMS latency budget |
