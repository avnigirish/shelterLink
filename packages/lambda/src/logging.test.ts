/**
 * Task 10.3 — Structured log output tests
 * Asserts:
 * - Logger is called with correct masked phone format on unauthorized attempt
 * - No raw phone number appears in any log message
 * Requirements: 5.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQSEvent } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Capture logger calls so we can assert on them
// ---------------------------------------------------------------------------
const logCalls: { level: string; message: string; extra: Record<string, unknown> }[] = [];

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

// Real maskPhone so we can verify the format
vi.mock('./registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./registry')>();
  return {
    ...actual,
    lookupRegistry: vi.fn(),
  };
});

vi.mock('./rateLimit', () => ({
  checkRateLimit: vi.fn(),
  recordUnauthorizedAttempt: vi.fn(),
}));

vi.mock('@aws-lambda-powertools/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: (msg: string, extra: Record<string, unknown> = {}) => {
      logCalls.push({ level: 'info', message: msg, extra });
    },
    warn: (msg: string, extra: Record<string, unknown> = {}) => {
      logCalls.push({ level: 'warn', message: msg, extra });
    },
    error: (msg: string, extra: Record<string, unknown> = {}) => {
      logCalls.push({ level: 'error', message: msg, extra });
    },
    debug: (msg: string, extra: Record<string, unknown> = {}) => {
      logCalls.push({ level: 'debug', message: msg, extra });
    },
  })),
}));

import { handler } from './handler';
import { lookupRegistry } from './registry';
import { checkRateLimit, recordUnauthorizedAttempt } from './rateLimit';

const RAW_PHONE = '+15551234567';
const MASKED_PHONE_RE = /^\+1\*{3}\d{4}$/; // +1***XXXX

function makeSqsEvent(messageBody: string, phone = RAW_PHONE): SQSEvent {
  const pinpointEvent = { originationNumber: phone, messageBody, destinationNumber: '+18005550100' };
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
  logCalls.length = 0;
  vi.clearAllMocks();
  mockDdbSend.mockResolvedValue({});
  mockPinpointSend.mockResolvedValue({});
  vi.mocked(checkRateLimit).mockResolvedValue({ suppressed: false });
  vi.mocked(lookupRegistry).mockResolvedValue({ authorized: true, shelterId: 'shelter-001' });
  vi.mocked(recordUnauthorizedAttempt).mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// Helper: collect all string values from log calls (message + extra fields)
// ---------------------------------------------------------------------------
function allLoggedStrings(): string[] {
  return logCalls.flatMap(({ message, extra }) => [
    message,
    ...Object.values(extra).map(String),
  ]);
}

describe('Structured log output — phone masking', () => {
  it('logs masked phone on unauthorized attempt, not raw phone', async () => {
    vi.mocked(lookupRegistry).mockResolvedValue({ authorized: false });
    await handler(makeSqsEvent('BEDS 5/10'));

    const unauthorizedLog = logCalls.find((c) => c.message === 'Unauthorized sender');
    expect(unauthorizedLog).toBeDefined();
    expect(unauthorizedLog!.extra['maskedPhone']).toMatch(MASKED_PHONE_RE);
  });

  it('never logs raw phone number in any log message or field', async () => {
    vi.mocked(lookupRegistry).mockResolvedValue({ authorized: false });
    await handler(makeSqsEvent('BEDS 5/10'));

    const allStrings = allLoggedStrings();
    for (const s of allStrings) {
      expect(s).not.toContain(RAW_PHONE);
    }
  });

  it('never logs raw phone on happy path', async () => {
    await handler(makeSqsEvent('BEDS 5/10'));

    const allStrings = allLoggedStrings();
    for (const s of allStrings) {
      expect(s).not.toContain(RAW_PHONE);
    }
  });

  it('never logs raw phone on parse failure', async () => {
    await handler(makeSqsEvent('not a valid sms'));

    const allStrings = allLoggedStrings();
    for (const s of allStrings) {
      expect(s).not.toContain(RAW_PHONE);
    }
  });

  it('logs outcome field on inbound SMS received', async () => {
    await handler(makeSqsEvent('BEDS 5/10'));

    const inboundLog = logCalls.find((c) => c.message === 'Inbound SMS received');
    expect(inboundLog).toBeDefined();
    expect(inboundLog!.extra['maskedPhone']).toMatch(MASKED_PHONE_RE);
  });

  it('masked phone matches +1***XXXX format', async () => {
    vi.mocked(lookupRegistry).mockResolvedValue({ authorized: false });
    await handler(makeSqsEvent('BEDS 5/10'));

    const phonesLogged = logCalls
      .flatMap(({ extra }) => Object.values(extra))
      .filter((v): v is string => typeof v === 'string' && v.startsWith('+1***'));

    expect(phonesLogged.length).toBeGreaterThan(0);
    for (const p of phonesLogged) {
      expect(p).toMatch(MASKED_PHONE_RE);
    }
  });
});
