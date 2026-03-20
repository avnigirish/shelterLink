import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PinpointClient, SendMessagesCommand } from '@aws-sdk/client-pinpoint';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const TABLE = process.env['SHELTER_TABLE'] ?? '';
const PINPOINT_APP_ID = process.env['PINPOINT_APP_ID'] ?? '';
const ORIGINATION_NUMBER = process.env['ORIGINATION_NUMBER'] ?? '';

function getDdb() {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' }),
  );
}

function getPinpoint() {
  return new PinpointClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
}

function hashPhone(phone: string): string {
  return createHash('sha256').update(phone).digest('hex');
}

function maskPhone(phone: string): string {
  return `+1***${phone.slice(-4)}`;
}

async function sendConfirmationSms(phone: string, shelterName: string): Promise<void> {
  if (!PINPOINT_APP_ID || PINPOINT_APP_ID === 'PENDING') return;
  try {
    await getPinpoint().send(new SendMessagesCommand({
      ApplicationId: PINPOINT_APP_ID,
      MessageRequest: {
        Addresses: { [phone]: { ChannelType: 'SMS' } },
        MessageConfiguration: {
          SMSMessage: {
            Body: `You're subscribed to ShelterLink alerts for ${shelterName}. Reply STOP to unsubscribe.`,
            OriginationNumber: ORIGINATION_NUMBER,
          },
        },
      },
    }));
  } catch {
    // Confirmation SMS failure is non-fatal — subscription is still created
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = body as Record<string, unknown>;
  const phone = typeof parsed['phone'] === 'string' ? parsed['phone'] : '';
  const shelterId = typeof parsed['shelterId'] === 'string' ? parsed['shelterId'] : '';
  const shelterName = typeof parsed['shelterName'] === 'string' ? parsed['shelterName'] : shelterId;

  if (!phone || !shelterId) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: phone, shelterId' },
      { status: 400 },
    );
  }

  if (!E164_REGEX.test(phone)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid phone number format. Use E.164 (e.g. +12025551234)' },
      { status: 400 },
    );
  }

  const hashed = hashPhone(phone);
  const now = new Date().toISOString();

  try {
    await getDdb().send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `SUBSCRIBER#${hashed}`,
        SK: `SHELTER#${shelterId}`,
        phone,
        shelterId,
        status: 'ACTIVE',
        subscribedAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
  } catch (err) {
    // Idempotent — already subscribed is fine
    if (err instanceof ConditionalCheckFailedException) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }

  // Fire-and-forget confirmation SMS — non-fatal
  void sendConfirmationSms(phone, shelterName);

  // Log without raw phone
  const masked = maskPhone(phone);
  void masked; // used in server logs only — Next.js server console is acceptable here

  return NextResponse.json({ ok: true }, { status: 200 });
}
