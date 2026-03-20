// Feature: community-activity-feed
// Property-based tests for the chat API route (P7, P8, P9)

import { describe, it, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';

// vi.mock calls are hoisted before imports by vitest, so these run before
// the route module is evaluated — ensuring USE_MOCK_DATA is set first.
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: vi.fn() })) },
  QueryCommand: vi.fn(),
  PutCommand: vi.fn(),
}));

// Hoisted env setup — runs before module evaluation
const { USE_MOCK_DATA } = vi.hoisted(() => {
  process.env.USE_MOCK_DATA = 'true';
  return { USE_MOCK_DATA: 'true' };
});

import { MOCK_MESSAGES } from '@/lib/mockChat';
import { GET, POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(shelterId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/chat/${shelterId}`);
}

function makePostRequest(shelterId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/chat/${shelterId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(shelterId: string) {
  return { params: { shelterId } };
}

// ---------------------------------------------------------------------------
// Reset shared state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  MOCK_MESSAGES.length = 0;
  // Ensure the env var stays set across tests (vi.hoisted sets it once at
  // module-evaluation time; this guards against any test that might clear it)
  process.env.USE_MOCK_DATA = USE_MOCK_DATA;
});

// ---------------------------------------------------------------------------
// Property 7: Chat endpoint shelter filtering
// For any shelterId, GET returns only messages where roomId === shelterId
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------

describe('P7: Chat endpoint shelter filtering', () => {
  it('returns only messages matching the requested shelterId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (targetId, otherId) => {
          fc.pre(targetId !== otherId);

          MOCK_MESSAGES.length = 0;
          MOCK_MESSAGES.push(
            { roomId: targetId, timestamp: new Date().toISOString(), senderName: 'Alice', message: 'Hello', userType: 'VOLUNTEER' },
            { roomId: otherId,  timestamp: new Date().toISOString(), senderName: 'Bob',   message: 'Hi',    userType: 'DONOR' },
            { roomId: targetId, timestamp: new Date().toISOString(), senderName: 'Carol', message: 'Hey',   userType: 'STAFF' },
          );

          const res = await GET(makeGetRequest(targetId), makeParams(targetId));
          const messages = await res.json() as Array<{ roomId: string }>;

          return messages.every((m) => m.roomId === targetId) && messages.length === 2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array when no messages exist for the shelterId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (shelterId) => {
          MOCK_MESSAGES.length = 0;

          const res = await GET(makeGetRequest(shelterId), makeParams(shelterId));
          const messages = await res.json() as unknown[];

          return Array.isArray(messages) && messages.length === 0;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: POST endpoint rejects empty/whitespace message
// For any body where message is absent, "", or whitespace-only → HTTP 400
// Validates: Requirements 7.5
// ---------------------------------------------------------------------------

describe('P8: POST endpoint rejects empty/whitespace message', () => {
  it('returns 400 with { error: "Missing message" } for blank messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.oneof(
          fc.constant(''),
          fc.constant(undefined),
          fc.stringOf(fc.constant(' '), { minLength: 1 })
        ),
        async (shelterId, message) => {
          const body = message === undefined
            ? { senderName: 'Test', userType: 'VOLUNTEER' }
            : { message, senderName: 'Test', userType: 'VOLUNTEER' };

          const res = await POST(makePostRequest(shelterId, body), makeParams(shelterId));
          const json = await res.json() as { error?: string };

          return res.status === 400 && json.error === 'Missing message';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: POST endpoint coerces invalid userType to VOLUNTEER
// For any userType not in VOLUNTEER | DONOR | STAFF, stored message has userType === "VOLUNTEER"
// Validates: Requirements 7.6
// ---------------------------------------------------------------------------

describe('P9: POST endpoint coerces invalid userType to VOLUNTEER', () => {
  it('stores userType as VOLUNTEER for any unrecognised userType value', async () => {
    const validTypes = ['VOLUNTEER', 'DONOR', 'STAFF'];

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string().filter((s) => !validTypes.includes(s)),
        async (shelterId, invalidUserType) => {
          MOCK_MESSAGES.length = 0;

          const res = await POST(
            makePostRequest(shelterId, { message: 'hello', senderName: 'Tester', userType: invalidUserType }),
            makeParams(shelterId)
          );

          if (res.status !== 200) return false;

          const stored = MOCK_MESSAGES.find((m) => m.roomId === shelterId);
          return stored?.userType === 'VOLUNTEER';
        }
      ),
      { numRuns: 100 }
    );
  });
});
