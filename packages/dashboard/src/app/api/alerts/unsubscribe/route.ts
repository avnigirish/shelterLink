import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const TABLE = process.env['SHELTER_TABLE'] ?? '';

function getDdb() {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' }),
  );
}

function hashPhone(phone: string): string {
  return createHash('sha256').update(phone).digest('hex');
}

function maskPhone(phone: string): string {
  return `+***${phone.slice(-4)}`;
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

  if (!phone) {
    return NextResponse.json({ ok: false, error: 'Missing required field: phone' }, { status: 400 });
  }

  if (!E164_REGEX.test(phone)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid phone number format. Use E.164 (e.g. +12025551234)' },
      { status: 400 },
    );
  }

  const hashed = hashPhone(phone);
  const pk = `SUBSCRIBER#${hashed}`;
  const masked = maskPhone(phone);
  const updatedAt = new Date().toISOString();
  const ddb = getDdb();

  try {
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    }));

    const items = result.Items ?? [];

    for (const item of items) {
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: pk, SK: item['SK'] as string },
        UpdateExpression: 'SET #st = :unsubscribed, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':unsubscribed': 'UNSUBSCRIBED', ':updatedAt': updatedAt },
      }));
    }

    // Structured log — masked phone only, never raw
    console.info(JSON.stringify({
      level: 'INFO',
      message: 'Unsubscribe request processed',
      maskedPhone: masked,
      count: items.length,
    }));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
