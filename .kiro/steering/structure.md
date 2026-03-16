# Project Structure

## Monorepo Layout

```
shelterlink/
├── packages/
│   ├── lambda/          # AWS Lambda — Update_Processor (SMS ingestion)
│   ├── dashboard/       # Next.js 14 — public dashboard + admin UI
│   └── infra/           # AWS CDK v2 — infrastructure as code
├── .kiro/
│   ├── specs/           # Spec-driven development artifacts
│   ├── steering/        # AI assistant context files (this directory)
│   └── hooks/           # Kiro automation hooks
└── package.json         # npm workspaces root
```

## `packages/lambda/src/`

| File | Purpose |
|---|---|
| `handler.ts` | SQS event handler — orchestrates parse → validate → write → reply |
| `parser.ts` | SMS body parser — returns `ParseResult` (discriminated union) |
| `prettyPrinter.ts` | Formats confirmation and error SMS replies |
| `registry.ts` | Phone number → shelter ID lookup; `maskPhone()` for safe logging |
| `rateLimit.ts` | Unauthorized attempt tracking and suppression logic |
| `types.ts` | Shared types: `CapacityRecord`, `ParseResult`, `Priority`, `ShelterStatus` |
| `streamHandler.ts` | DynamoDB Streams handler for SSE push |

## `packages/dashboard/src/`

```
app/
├── page.tsx                        # SSR home — shelter list
├── layout.tsx                      # Root layout
├── shelter/[id]/page.tsx           # SSR shelter detail
├── login/page.tsx                  # Login page
├── admin/
│   ├── layout.tsx                  # Admin layout (auth guard)
│   └── page.tsx                    # Admin dashboard
└── api/
    ├── auth/[...nextauth]/         # NextAuth.js route handler
    ├── updates/route.ts            # SSE endpoint — real-time shelter updates
    └── admin/shelters/
        ├── route.ts                # POST — add shelter to registry
        └── [id]/route.ts           # DELETE — remove shelter from registry

components/
├── ShelterList.tsx                 # Public shelter list with SSE updates
├── NeedsFilter.tsx                 # Priority filter for needs list
├── AddShelterForm.tsx              # Admin form — add shelter
└── RemoveShelterButton.tsx         # Admin action — remove shelter

lib/
├── db.ts                           # DynamoDB data-access (getAllShelters, getShelterById)
├── auth.ts                         # NextAuth config (GitHub OAuth)
├── registry.ts                     # Shelter registry CRUD
└── mockData.ts                     # Local dev mock data (real Springfield, IL shelters)

hooks/
└── useShelterUpdates.ts            # React hook — consumes SSE stream

types/
└── shelter.ts                      # Shared types (mirrors lambda/src/types.ts)
```

## `packages/infra/`

```
lib/shelter-link-stack.ts   # Single CDK stack — DynamoDB, SNS, SQS, Lambda, IAM
bin/                        # CDK app entry point
```

## Key Architectural Patterns

- **Single-table DynamoDB**: All data in one table. Access patterns use `PK=SHELTER#<id>` with sort keys `RECORD#CURRENT` (latest) and `LOG#<timestamp>` (history).
- **Discriminated union results**: Parser returns `{ ok: true; record } | { ok: false; error }` — always check `ok` before accessing `record`.
- **Mock/real data toggle**: `db.ts` and `updates/route.ts` check `USE_MOCK_DATA` env var — mock mode requires no AWS credentials.
- **Admin auth guard**: Admin routes check `getServerSession(authOptions)` — return 401 if no session.
- **Origin check**: Admin API routes validate `origin` header against `NEXT_PUBLIC_ALLOWED_ORIGIN`.
- **Types duplication**: `types/shelter.ts` (dashboard) and `types.ts` (lambda) are intentionally separate — no shared package to keep Lambda bundle lean.
