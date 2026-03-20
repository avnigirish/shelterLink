import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { ChatMessage, UserType } from '@/types/shelter';
import { MOCK_MESSAGES } from '@/lib/mockChat';

const TABLE = 'shelterlink-chat';
const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

let ddb: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!ddb) {
    const client = new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(client);
  }
  return ddb;
}


function isValidUserType(value: unknown): value is UserType {
  return value === 'VOLUNTEER' || value === 'DONOR' || value === 'STAFF';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { shelterId: string } }
) {
  const { shelterId } = params;

  if (USE_MOCK) {
    const messages = MOCK_MESSAGES.filter((m) => m.roomId === shelterId);
    return NextResponse.json(messages);
  }

  const result = await getClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `ROOM#${shelterId}` },
    ScanIndexForward: false,
    Limit: 50,
  }));

  const messages = ((result.Items ?? []) as ChatMessage[]).reverse();
  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { shelterId: string } }
) {
  const { shelterId } = params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body || typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  const senderName = typeof body.senderName === 'string' && body.senderName.trim()
    ? body.senderName.trim()
    : 'Anonymous';

  const userType: UserType = isValidUserType(body.userType) ? body.userType : 'VOLUNTEER';

  const timestamp = new Date().toISOString();
  const msg: ChatMessage = {
    roomId: shelterId,
    timestamp,
    senderName,
    message: body.message.trim(),
    userType,
  };

  if (USE_MOCK) {
    MOCK_MESSAGES.push(msg);
    return NextResponse.json({ ok: true });
  }

  // TTL: 30 days
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  await getClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `ROOM#${shelterId}`,
      SK: `MSG#${timestamp}`,
      ...msg,
      ttl,
    },
  }));

  return NextResponse.json({ ok: true });
}
