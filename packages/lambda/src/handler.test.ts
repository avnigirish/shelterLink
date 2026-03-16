import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQSEvent } from 'aws-lambda';

// Use vi.hoisted so these are available inside vi.mock factories (which are hoisted)
const { mockDdbSend, mockPinpointSend } = vi.hoisted(() => ({
  mockDdbSend: vi.fn(),
  mockPinpointSend: vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({ send: mockDdbSend }),
  },
  PutCommand: vi.fn(),
  TransactWriteCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-pinpoint', () => ({
  PinpointClient: vi.fn().mockImplementation(() => ({ send: mockPinpointSend })),
  SendMessagesCommand: vi.fn(),
}));

vi.mock('./registry', () => ({
  lookupRegistry: vi.fn(),
  maskPhone: vi.fn().mockReturnValue('+1***4567'),
  hashPhone: vi.fn().mockReturnValue('abc123'),
}));

vi.mock('./rateLimit', () => ({
  checkRateLimit: vi.fn(),
  recordUnauthorizedAttempt: vi.fn(),
}));

vi.mock('@aws-lambda-powertools/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { handler } from './handler';
import { lookupRegistry } from './registry';
import { checkRateLimit, recordUnauthorizedAttempt } from './rateLimit';

function makeSqsEvent(messageBody: string, originationNumber = '+15551234567'): SQSEvent {
  const pinpointEvent = {
    originationNumber,
    messageBody,
    destinationNumber: '+18005550100',
  };
  const snsNotification = { Message: JSON.stringify(pinpointEvent) };
  return {
    Records: [{
      messageId: 'msg-001',
      receiptHandle: 'handle',
      body: JSON.stringify(snsNotification),
      attributes: {} as never,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123:queue',
      awsRegion: 'us-east-1',
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDdbSend.mockResolvedValue({});
  mockPinpointSend.mockResolvedValue({});
  vi.mocked(checkRateLimit).mockResolvedValue({ suppressed: false });
  vi.mocked(lookupRegistry).mockResolvedValue({ authorized: true, shelterId: 'shelter-001' });
});

describe('handler orchestration', () => {
  it('happy path: valid SMS → DynamoDB write → confirmation SMS sent', async () => {
    const event = makeSqsEvent('BEDS 12/20 NEEDS blankets:high');
    const result = await handler(event);

    expect(result.batchItemFailures).toHaveLength(0);
    expect(checkRateLimit).toHaveBeenCalledOnce();
    expect(lookupRegistry).toHaveBeenCalledOnce();
    // DynamoDB TransactWrite should have been called
    expect(mockDdbSend).toHaveBeenCalled();
    // Pinpoint confirmation SMS should have been sent
    expect(mockPinpointSend).toHaveBeenCalled();
  });

  it('suppressed sender: no registry check, no reply', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ suppressed: true });
    const event = makeSqsEvent('BEDS 12/20');

    const result = await handler(event);

    expect(result.batchItemFailures).toHaveLength(0);
    expect(lookupRegistry).not.toHaveBeenCalled();
    expect(mockDdbSend).not.toHaveBeenCalled();
    expect(mockPinpointSend).not.toHaveBeenCalled();
  });

  it('unauthorized sender: records attempt, sends error reply, no DynamoDB write', async () => {
    vi.mocked(lookupRegistry).mockResolvedValue({ authorized: false });
    vi.mocked(recordUnauthorizedAttempt).mockResolvedValue(1);
    const event = makeSqsEvent('BEDS 12/20');

    const result = await handler(event);

    expect(result.batchItemFailures).toHaveLength(0);
    expect(recordUnauthorizedAttempt).toHaveBeenCalledOnce();
    // No DynamoDB TransactWrite on unauthorized
    expect(mockDdbSend).not.toHaveBeenCalled();
    // Error SMS should be sent via Pinpoint
    expect(mockPinpointSend).toHaveBeenCalledOnce();
  });

  it('parse failure: sends error reply with format example, no DynamoDB write', async () => {
    const event = makeSqsEvent('hello world this is not valid');

    const result = await handler(event);

    expect(result.batchItemFailures).toHaveLength(0);
    expect(recordUnauthorizedAttempt).not.toHaveBeenCalled();
    // No DynamoDB write on parse failure
    expect(mockDdbSend).not.toHaveBeenCalled();
    // Error SMS should be sent
    expect(mockPinpointSend).toHaveBeenCalledOnce();
  });

  it('returns batchItemFailures when processing throws', async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error('DynamoDB timeout'));
    const event = makeSqsEvent('BEDS 5/10');

    const result = await handler(event);

    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBe('msg-001');
  });
});
