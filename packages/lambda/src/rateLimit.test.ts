import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { checkRateLimit, recordUnauthorizedAttempt } from './rateLimit';

const mockSend = vi.fn();
const mockDdb = { send: mockSend } as unknown as DynamoDBDocumentClient;
const TABLE = 'test-table';
const PHONE = '+15559876543';

beforeEach(() => { mockSend.mockReset(); });

describe('checkRateLimit', () => {
  it('returns suppressed=false when no record exists', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await checkRateLimit(PHONE, mockDdb, TABLE);
    expect(result.suppressed).toBe(false);
  });

  it('returns suppressed=true when suppressedUntil is in the future', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    mockSend.mockResolvedValueOnce({ Item: { suppressedUntil: future } });
    const result = await checkRateLimit(PHONE, mockDdb, TABLE);
    expect(result.suppressed).toBe(true);
  });

  it('returns suppressed=false when suppressedUntil is in the past', async () => {
    const past = Math.floor(Date.now() / 1000) - 1;
    mockSend.mockResolvedValueOnce({ Item: { suppressedUntil: past } });
    const result = await checkRateLimit(PHONE, mockDdb, TABLE);
    expect(result.suppressed).toBe(false);
  });
});

describe('recordUnauthorizedAttempt', () => {
  it('returns the new attempt count', async () => {
    mockSend.mockResolvedValueOnce({ Attributes: { count: 3 } });
    const count = await recordUnauthorizedAttempt(PHONE, mockDdb, TABLE);
    expect(count).toBe(3);
  });

  it('sets suppression on 5th attempt (threshold boundary)', async () => {
    // First send: UpdateCommand returns count=5
    mockSend.mockResolvedValueOnce({ Attributes: { count: 5 } });
    // Second send: suppression UpdateCommand
    mockSend.mockResolvedValueOnce({});
    const count = await recordUnauthorizedAttempt(PHONE, mockDdb, TABLE);
    expect(count).toBe(5);
    // Should have called send twice: once for increment, once for suppression
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('does not set suppression below threshold', async () => {
    mockSend.mockResolvedValueOnce({ Attributes: { count: 4 } });
    await recordUnauthorizedAttempt(PHONE, mockDdb, TABLE);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
