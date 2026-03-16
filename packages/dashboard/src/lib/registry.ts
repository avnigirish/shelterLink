import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const TABLE = process.env.SHELTER_TABLE ?? '';

let ddb: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!ddb) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(client);
  }
  return ddb;
}

export interface RegistryEntry {
  shelterId: string;
  name: string;
  maskedPhone: string; // +1***XXXX format
}

/** Hash phone for DynamoDB key — never store raw phone */
function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

/** Mask phone for display: +15551234567 → +1***4567 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '+1***????';
  return `+1***${digits.slice(-4)}`;
}

export async function listRegistryEntries(): Promise<RegistryEntry[]> {
  if (process.env.USE_MOCK_DATA === 'true') return MOCK_REGISTRY;

  const result = await getClient().send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'REGISTRY#' },
    })
  );

  return (result.Items ?? []).map((item) => ({
    shelterId: item.shelterId as string,
    name: item.name as string,
    maskedPhone: item.maskedPhone as string,
  }));
}

export async function addRegistryEntry(
  shelterId: string,
  name: string,
  phone: string
): Promise<void> {
  if (process.env.USE_MOCK_DATA === 'true') {
    // Prevent duplicates in mock store
    if (!MOCK_REGISTRY.find((e) => e.shelterId === shelterId)) {
      MOCK_REGISTRY.push({ shelterId, name, maskedPhone: maskPhone(phone) });
    }
    return;
  }

  const hashed = hashPhone(phone);
  await getClient().send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `REGISTRY#${hashed}`,
        SK: 'METADATA',
        shelterId,
        name,
        maskedPhone: maskPhone(phone),
      },
    })
  );
}

export async function removeRegistryEntry(shelterId: string, hashedPhone: string): Promise<void> {
  if (process.env.USE_MOCK_DATA === 'true') {
    const idx = MOCK_REGISTRY.findIndex((e) => e.shelterId === shelterId);
    if (idx !== -1) MOCK_REGISTRY.splice(idx, 1);
    return;
  }

  await getClient().send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `REGISTRY#${hashedPhone}`, SK: 'METADATA' },
    })
  );
}

// ---------------------------------------------------------------------------
// Mock data for local dev (mutable so add/remove work in mock mode)
// ---------------------------------------------------------------------------
const MOCK_REGISTRY: RegistryEntry[] = [
  { shelterId: 'shelter-001', name: 'Helping Hands of Springfield', maskedPhone: '+1***0048' },
  { shelterId: 'shelter-002', name: 'Contact Ministries', maskedPhone: '+1***3939' },
  { shelterId: 'shelter-003', name: 'Sojourn Shelter and Services', maskedPhone: '+1***5100' },
  { shelterId: 'shelter-004', name: 'Inner City Mission', maskedPhone: '+1***3940' },
];
