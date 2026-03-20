import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { MOCK_DONATIONS } from '@/lib/mockDonations';

const TABLE = 'shelterlink-donations';
const ALLOWED_ORIGIN = process.env['NEXT_PUBLIC_ALLOWED_ORIGIN'] ?? 'http://localhost:3000';
const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

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
  { params }: { params: { donationId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body || typeof body.userId !== 'string' || !body.userId.trim()) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const { userId } = body;
  const deliveredAt = new Date().toISOString();

  if (USE_MOCK) {
    const donation = MOCK_DONATIONS.find((d) => d.donationId === params.donationId);
    if (!donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
    }
    donation.status = 'DELIVERED';
    donation.deliveredAt = deliveredAt;
    return NextResponse.json({ ok: true });
  }

  await getClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: `DONATION#${params.donationId}`,
    },
    UpdateExpression: 'SET #status = :status, deliveredAt = :deliveredAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'DELIVERED',
      ':deliveredAt': deliveredAt,
    },
  }));

  return NextResponse.json({ ok: true });
}
