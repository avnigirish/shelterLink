import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the route
// ---------------------------------------------------------------------------
vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));

vi.mock('@/lib/registry', () => ({
  addRegistryEntry: vi.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from 'next-auth';
import { addRegistryEntry } from '@/lib/registry';
import { POST } from './route';

const ALLOWED_ORIGIN = 'http://localhost:3000';

function makeRequest(body: unknown, origin = ALLOWED_ORIGIN): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/shelters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_ALLOWED_ORIGIN = ALLOWED_ORIGIN;
});

describe('POST /api/admin/shelters', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeRequest({ shelterId: 's1', name: 'Test', phone: '+15550001111' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when Origin header is invalid', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: '[email protected]' } } as never);
    const res = await POST(makeRequest({ shelterId: 's1', name: 'Test', phone: '+15550001111' }, 'https://evil.com'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: '[email protected]' } } as never);
    const res = await POST(makeRequest({ shelterId: 's1' }));
    expect(res.status).toBe(400);
  });

  it('returns 201 and calls addRegistryEntry on valid request', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: '[email protected]' } } as never);
    const res = await POST(makeRequest({ shelterId: 's1', name: 'Test Shelter', phone: '+15550001111' }));
    expect(res.status).toBe(201);
    expect(addRegistryEntry).toHaveBeenCalledWith('s1', 'Test Shelter', '+15550001111');
  });

  it('returns 500 when addRegistryEntry throws', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: '[email protected]' } } as never);
    vi.mocked(addRegistryEntry).mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    const res = await POST(makeRequest({ shelterId: 's1', name: 'Test Shelter', phone: '+15550001111' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to add shelter/i);
  });
});
