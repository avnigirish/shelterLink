# ShelterLink — Product Overview

ShelterLink is a real-time shelter capacity tracking system built for emergency response scenarios. Non-technical shelter staff send plain SMS messages to update bed availability and supply needs. Those updates appear instantly on a public-facing dashboard accessible to volunteers and donors — no account or app required.

## Critical Path

```
Shelter Manager (SMS) → AWS Pinpoint → SNS → SQS → Lambda (Update_Processor) → DynamoDB → Next.js Dashboard (SSE) → Volunteer/Donor
```

## Core Capabilities

- **SMS ingestion**: Shelter staff text updates in a structured plain-text format (`BEDS 12/50 STATUS open NEEDS blankets:high, water:critical`)
- **Real-time dashboard**: Public Next.js dashboard shows live shelter status via Server-Sent Events (SSE)
- **Admin panel**: Authenticated admin interface (GitHub OAuth) for managing the shelter registry
- **Rate limiting**: Unauthorized senders receive one reply, then are suppressed after 5 attempts
- **Audit log**: Every update is written as both `RECORD#CURRENT` (latest state) and `LOG#<timestamp>` (history, 90-day TTL)

## SMS Format

```
BEDS <current>/<total> [STATUS open|full|closed] [NEEDS <item>[:<priority>], ...] [FULFILLED <item>, ...]
```

- `BEDS` is required; `STATUS`, `NEEDS`, and `FULFILLED` are optional
- Case-insensitive, whitespace-tolerant
- Status is derived from occupancy if not explicitly provided (beds >= capacity → FULL)
- Priority defaults to MEDIUM if not specified

## Key Constraints

- AWS Pinpoint SMS requires sandbox approval — Pinpoint resources are commented out in CDK until approved
- Admin auth uses GitHub OAuth via NextAuth.js (not Cognito)
- Lambda reserved concurrency is 10 to prevent DynamoDB write throttling
- Phone numbers must never appear in plaintext in CloudWatch logs — always use `maskPhone()`
