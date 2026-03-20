import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDdbSend } = vi.hoisted(() => ({ mockDdbSend: vi.fn() }));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockDdbSend }) },
  UpdateCommand: vi.fn().mockImplementation((input) => ({ input })),
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { PATCH } from './route';
import { getServerSession } from 'next-auth';

const ORIGIN = 'http://localhost:3000';
process.env['NEXT_PUBLIC_ALLOWED_ORIGIN'] = ORIGIN;
process.env['SHELTER_TABLE'] = 'shelterlink-data';
process.env['USE_MOCK_DATA'] = 'false';

function makeReq(body: unknown, origin = ORIGIN) {
  return new NextRequest('http://localhost:3000/api/admin/shelters/shelter-001/inventory', {
    method: 'PATCH',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDdbSend.mockResolvedValue({});
});

describe('PATCH /api/admin/shelters/[id]/inventory', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(makeReq({ item: 'blankets', quantity: 10 }), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(401);
  });

  it('returns 403 on bad origin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await PATCH(makeReq({ item: 'blankets', quantity: 10 }, 'https://evil.com'), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(403);
  });

  it('returns 400 when item is missing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await PATCH(makeReq({ quantity: 5 }), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when quantity is negative', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await PATCH(makeReq({ item: 'blankets', quantity: -1 }), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when quantity is a float', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await PATCH(makeReq({ item: 'blankets', quantity: 1.5 }), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(400);
  });

  it('calls DynamoDB UpdateItem with expression attribute names and returns ok:true', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await PATCH(makeReq({ item: 'water bottles', quantity: 24 }), { params: { id: 'shelter-001' } });

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);

    // Verify UpdateCommand was called with expression attribute names (safe key handling)
    expect(mockDdbSend).toHaveBeenCalledOnce();
    const [updateCmd] = mockDdbSend.mock.calls[0] as [{ input: Record<string, unknown> }][];
    expect(updateCmd.input['UpdateExpression']).toBe('SET inventory.#item = :qty');
    expect(updateCmd.input['ExpressionAttributeNames']).toEqual({ '#item': 'water bottles' });
    expect(updateCmd.input['ExpressionAttributeValues']).toEqual({ ':qty': 24 });
    expect(updateCmd.input['Key']).toEqual({ PK: 'SHELTER#shelter-001', SK: 'RECORD#CURRENT' });
  });

  it('returns ok:true immediately in mock mode without calling DynamoDB', async () => {
    process.env['USE_MOCK_DATA'] = 'true';
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await PATCH(makeReq({ item: 'blankets', quantity: 5 }), { params: { id: 'shelter-001' } });

    expect(res.status).toBe(200);
    expect(mockDdbSend).not.toHaveBeenCalled();
    process.env['USE_MOCK_DATA'] = 'false';
  });
});
