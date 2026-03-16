import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { ShelterRecord } from '@/types/shelter';
import { MOCK_SHELTERS } from './mockData';

const TABLE = process.env.SHELTER_TABLE;
const USE_MOCK = !TABLE || process.env.USE_MOCK_DATA === 'true';

let ddb: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!ddb) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(client);
  }
  return ddb;
}

export async function getAllShelters(): Promise<ShelterRecord[]> {
  if (USE_MOCK) return MOCK_SHELTERS;

  const result = await getClient().send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'RECORD#CURRENT' },
  }));
  return (result.Items ?? []) as ShelterRecord[];
}

export async function getShelterById(id: string): Promise<ShelterRecord | null> {
  if (USE_MOCK) return MOCK_SHELTERS.find((s) => s.shelterId === id) ?? null;

  const result = await getClient().send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `SHELTER#${id}`, SK: 'RECORD#CURRENT' },
  }));
  return (result.Item as ShelterRecord) ?? null;
}
