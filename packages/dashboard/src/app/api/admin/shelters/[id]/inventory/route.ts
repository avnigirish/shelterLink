import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const ALLOWED_ORIGIN = process.env['NEXT_PUBLIC_ALLOWED_ORIGIN'] ?? 'http://localhost:3000';
const TABLE = process.env['SHELTER_TABLE'];

let ddb: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!ddb) {
    const client = new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(client);
  }
  return ddb;
}

function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin') ?? '';
  return origin === ALLOWED_ORIGIN;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body || typeof body.item !== 'string' || !body.item.trim()) {
    return NextResponse.json({ error: 'item must be a non-empty string' }, { status: 400 });
  }

  const item = body.item.trim();
  const quantity = body.quantity;

  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    return NextResponse.json({ error: 'quantity must be a non-negative integer' }, { status: 400 });
  }

  if (process.env['USE_MOCK_DATA'] === 'true') {
    return NextResponse.json({ ok: true });
  }

  await getClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `SHELTER#${params.id}`, SK: 'RECORD#CURRENT' },
    UpdateExpression: 'SET inventory.#item = :qty',
    ExpressionAttributeNames: { '#item': item },
    ExpressionAttributeValues: { ':qty': quantity },
  }));

  return NextResponse.json({ ok: true });
}
