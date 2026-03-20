import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDdbSend } = vi.hoisted(() => ({ mockDdbSend: vi.fn() }));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockDdbSend }) },
  DeleteCommand: vi.fn(),
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { DELETE } from './route';
import { getServerSession } from 'next-auth';

const ORIGIN = 'http://localhost:3000';
process.env['NEXT_PUBLIC_ALLOWED_ORIGIN'] = ORIGIN;
process.env['SHELTER_TABLE'] = 'shelterlink-data';

function makeReq(origin = ORIGIN) {
  return new NextRequest('http://localhost:3000/api/admin/shelters/shelter-001', {
    method: 'DELETE',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ hashedPhone: 'abc123' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDdbSend.mockResolvedValue({});
});

describe('DELETE /api/admin/shelters/[id]', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await DELETE(makeReq(), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(401);
  });

  it('returns 403 on bad origin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await DELETE(makeReq('https://evil.com'), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(403);
  });

  it('calls DynamoDB DeleteCommand and returns 200 on valid request', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'a@b.com' } } as never);
    const res = await DELETE(makeReq(), { params: { id: 'shelter-001' } });
    expect(res.status).toBe(200);
    expect(mockDdbSend).toHaveBeenCalledOnce();
  });
});
