import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));

vi.mock('@/lib/registry', () => ({
  removeRegistryEntry: vi.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from 'next-auth';
import { removeRegistryEntry } from '@/lib/registry';
import { DELETE } from './route';

const ALLOWED_ORIGIN = 'http://localhost:3000';

function makeRequest(body: unknown, origin = ALLOWED_ORIGIN): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/shelters/s1', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  });
}

const routeParams = { params: { id: 's1' } };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_ALLOWED_ORIGIN = ALLOWED_ORIGIN;
});

describe('DELETE /api/admin/shelters/[id]', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await DELETE(makeRequest({ hashedPhone: 'abc123' }), routeParams);
    expect(res.status).toBe(401);
  });

  it('returns 403 when Origin header is invalid', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: '[email protected]' } } as never);
    const res = await DELETE(makeRequest({ hashedPhone: 'abc123' }, 'https://evil.com'), routeParams);
    expect(res.status).toBe(403);
  });

  it('returns 400 when hashedPhone is missing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: '[email protected]' } } as never);
    const res = await DELETE(makeRequest({}), routeParams);
    expect(res.status).toBe(400);
  });

  it('returns 200 and calls removeRegistryEntry on valid request', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: '[email protected]' } } as never);
    const res = await DELETE(makeRequest({ hashedPhone: 'abc123' }), routeParams);
    expect(res.status).toBe(200);
    expect(removeRegistryEntry).toHaveBeenCalledWith('s1', 'abc123');
  });
});
