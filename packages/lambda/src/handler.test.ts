import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQSEvent, APIGatewayProxyEventV2, SQSBatchResponse, APIGatewayProxyResultV2 } from 'aws-lambda';

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

// Type helpers
function asSqsResult(r: SQSBatchResponse | APIGatewayProxyResultV2): SQSBatchResponse {
  return r as SQSBatchResponse;
}
function asHttpResult(r: SQSBatchResponse | APIGatewayProxyResultV2): APIGatewayProxyResultV2 {
  return r as APIGatewayProxyResultV2;
}

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

function makeFunctionUrlEvent(body: string): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789',
      apiId: 'abc123',
      domainName: 'abc123.lambda-url.us-east-1.on.aws',
      domainPrefix: 'abc123',
      http: {
        method: 'POST',
        path: '/',
        protocol: 'HTTP/1.1',
        sourceIp: '1.2.3.4',
        userAgent: 'test',
      },
      requestId: 'req-001',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    body,
    isBase64Encoded: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDdbSend.mockResolvedValue({});
  mockPinpointSend.mockResolvedValue({});
  vi.mocked(checkRateLimit).mockResolvedValue({ suppressed: false });
  vi.mocked(lookupRegistry).mockResolvedValue({ authorized: true, shelterId: 'shelter-001' });
});

describe('SQS handler orchestration', () => {
  it('happy path: valid SMS → DynamoDB write → confirmation SMS sent', async () => {
    const event = makeSqsEvent('BEDS 12/20 NEEDS blankets:high');
    const result = asSqsResult(await handler(event));

    expect(result.batchItemFailures).toHaveLength(0);
    expect(checkRateLimit).toHaveBeenCalledOnce();
    expect(lookupRegistry).toHaveBeenCalledOnce();
    expect(mockDdbSend).toHaveBeenCalled();
    // Pinpoint is disabled (no PINPOINT_APP_ID) — SMS reply is skipped silently
  });

  it('suppressed sender: no registry check, no reply', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ suppressed: true });
    const event = makeSqsEvent('BEDS 12/20');

    const result = asSqsResult(await handler(event));

    expect(result.batchItemFailures).toHaveLength(0);
    expect(lookupRegistry).not.toHaveBeenCalled();
    expect(mockDdbSend).not.toHaveBeenCalled();
    expect(mockPinpointSend).not.toHaveBeenCalled();
  });

  it('unauthorized sender: records attempt, sends error reply, no DynamoDB write', async () => {
    vi.mocked(lookupRegistry).mockResolvedValue({ authorized: false });
    vi.mocked(recordUnauthorizedAttempt).mockResolvedValue(1);
    const event = makeSqsEvent('BEDS 12/20');

    const result = asSqsResult(await handler(event));

    expect(result.batchItemFailures).toHaveLength(0);
    expect(recordUnauthorizedAttempt).toHaveBeenCalledOnce();
    expect(mockDdbSend).not.toHaveBeenCalled();
    // Pinpoint disabled — SMS reply skipped silently
  });

  it('parse failure: sends error reply with format example, no DynamoDB write', async () => {
    const event = makeSqsEvent('hello world this is not valid');

    const result = asSqsResult(await handler(event));

    expect(result.batchItemFailures).toHaveLength(0);
    expect(recordUnauthorizedAttempt).not.toHaveBeenCalled();
    expect(mockDdbSend).not.toHaveBeenCalled();
    // Pinpoint disabled — SMS reply skipped silently
  });

  it('returns batchItemFailures when processing throws', async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error('DynamoDB timeout'));
    const event = makeSqsEvent('BEDS 5/10');

    const result = asSqsResult(await handler(event));

    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBe('msg-001');
  });
});

describe('Function URL handler', () => {
  it('happy path: valid POST → 200 with confirmation', async () => {
    const event = makeFunctionUrlEvent(JSON.stringify({ phone: '+15551234567', body: 'BEDS 10/20' }));
    const result = asHttpResult(await handler(event));

    expect(result).toMatchObject({ statusCode: 200 });
    const parsed = JSON.parse((result as { statusCode: number; body: string }).body);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.confirmation).toBe('string');
    expect(mockDdbSend).toHaveBeenCalled();
    // Pinpoint disabled — SMS reply skipped silently
  });

  it('missing phone field → 400', async () => {
    const event = makeFunctionUrlEvent(JSON.stringify({ body: 'BEDS 10/20' }));
    const result = asHttpResult(await handler(event));

    expect(result).toMatchObject({ statusCode: 400 });
    const parsed = JSON.parse((result as { statusCode: number; body: string }).body);
    expect(parsed.ok).toBe(false);
    expect(mockDdbSend).not.toHaveBeenCalled();
  });

  it('missing body field → 400', async () => {
    const event = makeFunctionUrlEvent(JSON.stringify({ phone: '+15551234567' }));
    const result = asHttpResult(await handler(event));

    expect(result).toMatchObject({ statusCode: 400 });
    const parsed = JSON.parse((result as { statusCode: number; body: string }).body);
    expect(parsed.ok).toBe(false);
  });

  it('invalid JSON body → 400', async () => {
    const event = makeFunctionUrlEvent('not-json');
    const result = asHttpResult(await handler(event));

    expect(result).toMatchObject({ statusCode: 400 });
    const parsed = JSON.parse((result as { statusCode: number; body: string }).body);
    expect(parsed.ok).toBe(false);
  });

  it('suppressed/unauthorized sender → 403', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ suppressed: true });
    const event = makeFunctionUrlEvent(JSON.stringify({ phone: '+15551234567', body: 'BEDS 10/20' }));
    const result = asHttpResult(await handler(event));

    expect(result).toMatchObject({ statusCode: 403 });
    const parsed = JSON.parse((result as { statusCode: number; body: string }).body);
    expect(parsed.ok).toBe(false);
  });

  it('parse failure → 200 with ok:false (error SMS sent via Pinpoint)', async () => {
    const event = makeFunctionUrlEvent(JSON.stringify({ phone: '+15551234567', body: 'not valid sms' }));
    const result = asHttpResult(await handler(event));

    // Parse failures return null from processUpdate → 403
    expect(result).toMatchObject({ statusCode: 403 });
    const parsed = JSON.parse((result as { statusCode: number; body: string }).body);
    expect(parsed.ok).toBe(false);
    // Pinpoint disabled — SMS reply skipped silently
    expect(mockDdbSend).not.toHaveBeenCalled();
  });
});
