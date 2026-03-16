import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { lookupRegistry, maskPhone, hashPhone } from './registry';

const mockSend = vi.fn();
const mockDdb = { send: mockSend } as unknown as DynamoDBDocumentClient;
const TABLE = 'test-table';
const PHONE = '+15551234567';

beforeEach(() => { mockSend.mockReset(); });

describe('maskPhone', () => {
  it('masks all but last 4 digits', () => {
    expect(maskPhone('+15551234567')).toBe('+1***4567');
  });
});

describe('hashPhone', () => {
  it('returns a 64-char hex string', () => {
    expect(hashPhone(PHONE)).toMatch(/^[a-f0-9]{64}$/);
  });
  it('is deterministic', () => {
    expect(hashPhone(PHONE)).toBe(hashPhone(PHONE));
  });
});

describe('lookupRegistry', () => {
  it('returns authorized=true with shelterId when item found', async () => {
    mockSend.mockResolvedValueOnce({ Item: { shelterId: 'shelter-001' } });
    const result = await lookupRegistry(PHONE, mockDdb, TABLE);
    expect(result.authorized).toBe(true);
    expect(result.shelterId).toBe('shelter-001');
  });

  it('returns authorized=false when item not found', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await lookupRegistry(PHONE, mockDdb, TABLE);
    expect(result.authorized).toBe(false);
    expect(result.shelterId).toBeUndefined();
  });

  it('queries with hashed phone as PK', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    await lookupRegistry(PHONE, mockDdb, TABLE);
    const call = mockSend.mock.calls[0][0];
    expect(call.input.Key.PK).toBe(`REGISTRY#${hashPhone(PHONE)}`);
  });
});
