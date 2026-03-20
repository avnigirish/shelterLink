// Feature: community-activity-feed
// Unit tests for advocate pledge notification failure handling
// Requirements: 1.2, 1.3, 1.4

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

const { bedrockSend } = vi.hoisted(() => {
  process.env.USE_MOCK_DATA = 'true';
  const bedrockSend = vi.fn();
  return { bedrockSend };
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

/** Queues two Bedrock responses: tool_use → PledgeTool, then end_turn */
function queuePledgeRun(input: PledgeInput): void {
  bedrockSend
    .mockImplementationOnce(() =>
      Promise.resolve({
        stopReason: 'tool_use',
        output: {
          message: {
            role: 'assistant',
            content: [{ toolUse: { toolUseId: 'tool-1', name: 'PledgeTool', input } }],
          },
        },
      })
    )
    .mockImplementationOnce(() =>
      Promise.resolve({
        stopReason: 'end_turn',
        output: { message: { role: 'assistant', content: [{ text: 'Pledge confirmed.' }] } },
      })
    );
}

let ipCounter = 0;
function makeRequest(): NextRequest {
  ipCounter += 1;
  return new NextRequest('http://localhost:3000/api/advocate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.1.${Math.floor(ipCounter / 255)}.${ipCounter % 255}`,
    },
    body: JSON.stringify({ message: 'Please pledge for me', context: 'home' }),
  });
}

beforeEach(() => {
  MOCK_MESSAGES.length = 0;
  bedrockSend.mockReset();
  process.env.USE_MOCK_DATA = 'true';
});

// ---------------------------------------------------------------------------
// Requirement 1.4: executeAlertTool throwing does not cause executePledgeTool to throw
// The pledge must still succeed (200 response with pledge data) even when the
// notification post fails.
// ---------------------------------------------------------------------------

describe('Requirement 1.4: non-fatal alert tool failure', () => {
  it('returns a successful pledge response even when MOCK_MESSAGES.push throws', async () => {
    // Simulate executeAlertTool failing by making MOCK_MESSAGES.push throw
    const originalPush = MOCK_MESSAGES.push.bind(MOCK_MESSAGES);
    vi.spyOn(MOCK_MESSAGES, 'push').mockImplementationOnce(() => {
      throw new Error('Simulated alert failure');
    });

    queuePledgeRun({ shelterId: 'shelter-001', item: 'blankets', quantity: 5, donorName: 'Alice' });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json() as { text: string };
    expect(body.text).toBeTruthy();

    // Restore
    vi.spyOn(MOCK_MESSAGES, 'push').mockImplementation(originalPush);
  });

  it('returns HTTP 200 with text regardless of alert failure', async () => {
    vi.spyOn(MOCK_MESSAGES, 'push').mockImplementationOnce(() => {
      throw new Error('Network error posting to chat');
    });

    queuePledgeRun({ shelterId: 'shelter-002', item: 'water', donorName: 'Bob' });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json() as { text: string };
    expect(typeof body.text).toBe('string');
    expect(body.text.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Requirement 1.2: pledge notification uses "Anonymous" when donorName is absent
// ---------------------------------------------------------------------------

describe('Requirement 1.2: Anonymous fallback when donorName is absent', () => {
  it('posts "Anonymous" in the notification message when donorName is not provided', async () => {
    queuePledgeRun({ shelterId: 'shelter-001', item: 'blankets' }); // no donorName

    await POST(makeRequest());

    const msg = MOCK_MESSAGES.find(
      (m) => m.roomId === 'shelter-001' && m.senderName === 'Community Advocate'
    );
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('Anonymous');
  });

  it('posts "Anonymous" when donorName is absent (undefined via ??)', async () => {
    // The route uses `String(input['donorName'] ?? 'Anonymous')` — only absent (null/undefined)
    // triggers the fallback. An explicit empty string is passed through as-is.
    queuePledgeRun({ shelterId: 'shelter-001', item: 'water' }); // donorName key absent entirely

    await POST(makeRequest());

    const msg = MOCK_MESSAGES.find(
      (m) => m.roomId === 'shelter-001' && m.senderName === 'Community Advocate'
    );
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('Anonymous');
  });

  it('uses the provided donorName when it is present and non-empty', async () => {
    queuePledgeRun({ shelterId: 'shelter-001', item: 'coats', donorName: 'Carol' });

    await POST(makeRequest());

    const msg = MOCK_MESSAGES.find(
      (m) => m.roomId === 'shelter-001' && m.senderName === 'Community Advocate'
    );
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('Carol');
    expect(msg?.message).not.toContain('Anonymous');
  });
});

// ---------------------------------------------------------------------------
// Requirement 1.3: pledge notification defaults quantity to 1 when absent
// ---------------------------------------------------------------------------

describe('Requirement 1.3: quantity defaults to 1 when absent', () => {
  it('uses quantity 1 in the notification message when quantity is not provided', async () => {
    queuePledgeRun({ shelterId: 'shelter-001', item: 'meals' }); // no quantity

    await POST(makeRequest());

    const msg = MOCK_MESSAGES.find(
      (m) => m.roomId === 'shelter-001' && m.senderName === 'Community Advocate'
    );
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('1×');
  });

  it('uses the provided quantity when it is present', async () => {
    queuePledgeRun({ shelterId: 'shelter-001', item: 'blankets', quantity: 10 });

    await POST(makeRequest());

    const msg = MOCK_MESSAGES.find(
      (m) => m.roomId === 'shelter-001' && m.senderName === 'Community Advocate'
    );
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('10×');
    expect(msg?.message).not.toContain('1×');
  });

  it('uses quantity 0 literally when explicitly provided as 0', async () => {
    queuePledgeRun({ shelterId: 'shelter-001', item: 'tents', quantity: 0 });

    await POST(makeRequest());

    const msg = MOCK_MESSAGES.find(
      (m) => m.roomId === 'shelter-001' && m.senderName === 'Community Advocate'
    );
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('0×');
  });
});
