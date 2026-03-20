import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { DonationItem } from '@/types/shelter';

const TABLE = 'shelterlink-donations';

let ddb: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!ddb) {
    const client = new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(client);
  }
  return ddb;
}

function isDonationItemArray(value: unknown): value is DonationItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (it) =>
        typeof it === 'object' &&
        it !== null &&
        typeof (it as Record<string, unknown>).item === 'string' &&
        typeof (it as Record<string, unknown>).quantity === 'number'
    )
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { shelterId, shelterName, donorName, donorEmail, items } = body;

  if (typeof shelterId !== 'string' || !shelterId.trim()) {
    return NextResponse.json({ error: 'shelterId is required' }, { status: 400 });
  }
  if (typeof shelterName !== 'string' || !shelterName.trim()) {
    return NextResponse.json({ error: 'shelterName is required' }, { status: 400 });
  }
  if (typeof donorEmail !== 'string' || !donorEmail.trim()) {
    return NextResponse.json({ error: 'donorEmail is required' }, { status: 400 });
  }
  if (!isDonationItemArray(items)) {
    return NextResponse.json({ error: 'items must be a non-empty array of { item, quantity }' }, { status: 400 });
  }

  const donationId = randomUUID();
  const userId = createHash('sha256').update(donorEmail.trim()).digest('hex').slice(0, 16);
  const pledgedAt = new Date().toISOString();

  if (process.env['USE_MOCK_DATA'] === 'true') {
    return NextResponse.json({ ok: true, donationId: `mock-${Date.now()}` });
  }

  await getClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: `DONATION#${donationId}`,
      userId,
      donationId,
      shelterId: shelterId.trim(),
      shelterName: shelterName.trim(),
      donorName: typeof donorName === 'string' ? donorName.trim() : '',
      donorEmail: donorEmail.trim(),
      items,
      status: 'PLEDGED',
      pledgedAt,
    },
  }));

  return NextResponse.json({ ok: true, donationId });
}
