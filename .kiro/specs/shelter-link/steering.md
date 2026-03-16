# Kiro Steering Rules — ShelterLink

These rules guide Kiro's code generation and task execution for the ShelterLink project.
All generated code, scaffolding, and configuration must comply with these constraints.

---

## Language & Runtime

- ALL source files must be TypeScript. No plain JavaScript files (.js) in `src/` or Lambda handlers.
- Lambda handlers must target Node.js 20.x and be compiled with esbuild (no ts-node in production).
- Next.js pages and API routes must use TypeScript with strict mode enabled (`"strict": true` in tsconfig.json).
- All types must be explicitly declared. Avoid `any`; use `unknown` with type guards where the shape is uncertain.

## AWS Patterns

- All AWS resource access must go through the AWS SDK v3 (modular imports only — no `aws-sdk` v2).
- Lambda functions must read configuration from environment variables; no hardcoded ARNs, table names, or region strings.
- IAM roles generated for Lambda must follow least-privilege: scope `Resource` to specific ARN patterns, never `"*"`.
- DynamoDB access must use the `@aws-sdk/lib-dynamodb` DocumentClient with typed command inputs.
- All AWS infrastructure definitions must be written in AWS CDK (TypeScript). No CloudFormation YAML or Terraform.

## Architecture Constraints

- No always-on compute. Do not generate EC2 instances, ECS services, or RDS databases.
- Real-time push to the Dashboard must use Server-Sent Events (SSE) or WebSocket via API Gateway — no client polling loops shorter than 30 seconds.
- All DynamoDB table definitions must use single-table design with `PK`/`SK` composite keys.
- DynamoDB Streams must be the trigger for real-time Dashboard updates — do not poll DynamoDB from the frontend.

## Frontend Constraints

- The Dashboard must be built with Next.js (App Router) and Tailwind CSS.
- All interactive components must be server components by default; use `"use client"` only when browser APIs are required.
- Every page must have a server-rendered fallback that works without JavaScript.
- Color tokens in Tailwind config must meet WCAG 2.1 AA contrast ratios (4.5:1 for text, 3:1 for UI components).
- All status indicators must include both a color and a text label or icon with `aria-label`.
- Real-time update regions must use `aria-live="polite"` ARIA attributes.

## Security Rules

- Never generate code that writes raw user input (SMS body content) directly to DynamoDB without parsing and validation first.
- Admin API routes must validate NextAuth.js session tokens before executing any write operation.
- All Next.js API routes that mutate state must verify the `Origin` header against `NEXT_PUBLIC_ALLOWED_ORIGIN`.
- Phone numbers must never appear in plaintext in CloudWatch logs. Use masked format: `+1***XXXX` or hash for audit entries.

## Code Quality

- All Lambda handlers and Next.js API routes must have corresponding unit tests using Vitest.
- Parser and Pretty_Printer modules must have property-based tests covering the round-trip invariant.
- No `console.log` in Lambda handlers — use structured logging with `@aws-lambda-powertools/logger`.
- All async functions must handle errors explicitly; no unhandled promise rejections.
- Generated code must not include TODO comments or placeholder implementations — produce working code or ask for clarification.
