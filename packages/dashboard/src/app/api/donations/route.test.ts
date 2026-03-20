import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDdbSend } = vi.hoisted(() => ({ mockDdbSend: vi.fn() }));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockDdbSend }) },
  PutCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

import { POST } from './route';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

function makeReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/donations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  shelterId: 'shelter-001',
  shelterName: 'Central Shelter',
  donorEmail: 'donor@example.com',
  donorName: 'Jane Doe',
  items: [{ item: 'water', quantity: 10 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDdbSend.mockResolvedValue({});
});

describe('POST /api/donations', () => {
  it('returns 400 when shelterId is missing', async () => {
    const res = await POST(makeReq({ shelterName: 'Test', donorEmail: 'a@b.com', items: [{ item: 'water', quantity: 2 }] }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/shelterId/);
  });

  it('returns 400 when donorEmail is missing', async () => {
    const res = await POST(makeReq({ shelterId: 's1', shelterName: 'Test', items: [{ item: 'water', quantity: 2 }] }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/donorEmail/);
  });

  it('returns 400 when items is empty', async () => {
    const res = await POST(makeReq({ shelterId: 's1', shelterName: 'Test', donorEmail: 'a@b.com', items: [] }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/items/);
  });

  it('writes correct PK/SK and status to DynamoDB', async () => {
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockDdbSend).toHaveBeenCalledOnce();

    const putCmd = vi.mocked(PutCommand).mock.calls[0]?.[0] as {
      Item: Record<string, unknown>;
    };
    expect(putCmd.Item['PK']).toMatch(/^USER#/);
    expect(putCmd.Item['SK']).toMatch(/^DONATION#/);
    expect(putCmd.Item['status']).toBe('PLEDGED');
    expect(putCmd.Item['shelterId']).toBe('shelter-001');
  });

  it('returns ok:true with a donationId on success', async () => {
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; donationId: string };
    expect(json.ok).toBe(true);
    expect(typeof json.donationId).toBe('string');
    expect(json.donationId.length).toBeGreaterThan(0);
  });
});
