// Feature: community-activity-feed
// Property-based tests for pledge notification format and mock store write (P1, P2)

import { describe, it, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock AWS SDK before any module is evaluated
// ---------------------------------------------------------------------------

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: vi.fn() })) },
  PutCommand: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  getAllShelters: vi.fn().mockResolvedValue([]),
  getShelterById: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Hoisted: env setup + stable bedrockSend reference
// ---------------------------------------------------------------------------

const { USE_MOCK_DATA, bedrockSend } = vi.hoisted(() => {
  process.env.USE_MOCK_DATA = 'true';
  const bedrockSend = vi.fn();
  return { USE_MOCK_DATA: 'true', bedrockSend };
});

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(() => ({ send: bedrockSend })),
  ConverseCommand: vi.fn((args: unknown) => args),
}));

import { MOCK_MESSAGES } from '@/lib/mockChat';
import { POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PledgeInput = {
  shelterId: string;
  item: string;
  quantity?: number;
  donorName?: string;
};

/**
 * Queues two Bedrock responses for one agentic loop iteration:
 *   1. tool_use → PledgeTool with the given input
 *   2. end_turn → "Pledge confirmed."
 */
function queuePledgeRun(input: PledgeInput): void {
  bedrockSend
    .mockImplementationOnce(() =>
      Promise.resolve({
        stopReason: 'tool_use',
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                toolUse: {
                  toolUseId: 'tool-1',
                  name: 'PledgeTool',
                  input,
                },
              },
            ],
          },
        },
      })
    )
    .mockImplementationOnce(() =>
      Promise.resolve({
        stopReason: 'end_turn',
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Pledge confirmed.' }],
          },
        },
      })
    );
}

// Each call gets a unique IP so the module-level rate limiter never blocks
let ipCounter = 0;
function makeAdvocateRequest(): NextRequest {
  ipCounter += 1;
  return new NextRequest('http://localhost:3000/api/advocate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.0.${Math.floor(ipCounter / 255)}.${ipCounter % 255}`,
    },
    body: JSON.stringify({ message: 'Please pledge for me', context: 'home' }),
  });
}

// ---------------------------------------------------------------------------
// Reset shared state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  MOCK_MESSAGES.length = 0;
  bedrockSend.mockReset();
  process.env.USE_MOCK_DATA = USE_MOCK_DATA;
});

// ---------------------------------------------------------------------------
// Property 1: Pledge notification format
// For any donorName (including absent/empty), quantity (including absent),
// item, and shelterId — the ChatMessage pushed to MOCK_MESSAGES has:
//   senderName === "Community Advocate"
//   userType === "ADMIN"
//   roomId === shelterId
//   message matching /^🤝 .+ has pledged to donate \d+× .+$/
//   donorName absent/empty → "Anonymous" in message
//   quantity absent → 1 in message
// Validates: Requirements 1.1, 1.2, 1.3, 1.6
// ---------------------------------------------------------------------------

describe('P1: Pledge notification format', () => {
  it('pushes a correctly-formatted ChatMessage to MOCK_MESSAGES for any pledge input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          donorName: fc.option(fc.string(), { nil: undefined }),
          quantity: fc.option(fc.nat(), { nil: undefined }),
          item: fc.string({ minLength: 1 }),
          shelterId: fc.string({ minLength: 1 }),
        }),
        async ({ donorName, quantity, item, shelterId }) => {
          MOCK_MESSAGES.length = 0;

          const pledgeInput: PledgeInput = { shelterId, item };
          if (quantity !== undefined) pledgeInput.quantity = quantity;
          // Only set donorName when non-empty; absent/empty → route defaults to "Anonymous"
          if (donorName !== undefined && donorName !== '') pledgeInput.donorName = donorName;

          queuePledgeRun(pledgeInput);
          await POST(makeAdvocateRequest());

          const msg = MOCK_MESSAGES.find(
            (m) => m.roomId === shelterId && m.senderName === 'Community Advocate'
          );
          if (!msg) return false;

          if (msg.senderName !== 'Community Advocate') return false;
          if (msg.userType !== 'ADMIN') return false;
          if (msg.roomId !== shelterId) return false;
          if (!/^🤝 .+ has pledged to donate \d+× .+$/.test(msg.message)) return false;

          const expectedDonor = donorName ? donorName : 'Anonymous';
          if (!msg.message.includes(expectedDonor)) return false;

          const expectedQty = quantity ?? 1;
          if (!msg.message.includes(`${expectedQty}×`)) return false;

          if (!msg.message.includes(item)) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('uses "Anonymous" when donorName is absent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (shelterId, item) => {
          MOCK_MESSAGES.length = 0;
          queuePledgeRun({ shelterId, item }); // no donorName

          await POST(makeAdvocateRequest());

          const msg = MOCK_MESSAGES.find(
            (m) => m.roomId === shelterId && m.senderName === 'Community Advocate'
          );
          return msg?.message.includes('Anonymous') ?? false;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('defaults quantity to 1 when quantity is absent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (shelterId, item) => {
          MOCK_MESSAGES.length = 0;
          queuePledgeRun({ shelterId, item }); // no quantity

          await POST(makeAdvocateRequest());

          const msg = MOCK_MESSAGES.find(
            (m) => m.roomId === shelterId && m.senderName === 'Community Advocate'
          );
          return msg?.message.includes('1×') ?? false;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Pledge notification written to mock store
// For any valid pledge input in mock mode, after executePledgeTool completes,
// MOCK_MESSAGES contains exactly one new message with
//   senderName === "Community Advocate" and userType === "ADMIN"
// compared to the pre-pledge snapshot.
// Validates: Requirements 1.6, 1.5
// ---------------------------------------------------------------------------

describe('P2: Pledge notification written to mock store', () => {
  it('adds exactly one advocate message to MOCK_MESSAGES per pledge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          shelterId: fc.string({ minLength: 1 }),
          item: fc.string({ minLength: 1 }),
          quantity: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
          donorName: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        }),
        async ({ shelterId, item, quantity, donorName }) => {
          MOCK_MESSAGES.length = 0;

          const pledgeInput: PledgeInput = { shelterId, item };
          if (quantity !== undefined) pledgeInput.quantity = quantity;
          if (donorName !== undefined) pledgeInput.donorName = donorName;

          const beforeCount = MOCK_MESSAGES.filter(
            (m) => m.senderName === 'Community Advocate' && m.userType === 'ADMIN'
          ).length;

          queuePledgeRun(pledgeInput);
          await POST(makeAdvocateRequest());

          const afterCount = MOCK_MESSAGES.filter(
            (m) => m.senderName === 'Community Advocate' && m.userType === 'ADMIN'
          ).length;

          return afterCount - beforeCount === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('advocate message is visible to a subsequent GET on the same shelterId', async () => {
    const { GET } = await import('../chat/[shelterId]/route');

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (shelterId, item) => {
          MOCK_MESSAGES.length = 0;
          queuePledgeRun({ shelterId, item });

          await POST(makeAdvocateRequest());

          const res = await GET(
            new NextRequest(`http://localhost:3000/api/chat/${shelterId}`),
            { params: { shelterId } }
          );
          const messages = await res.json() as Array<{ senderName: string; userType: string }>;

          return messages.some(
            (m) => m.senderName === 'Community Advocate' && m.userType === 'ADMIN'
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});
