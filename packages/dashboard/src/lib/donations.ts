import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { DonationRecord } from '@/types/shelter';
import { MOCK_DONATIONS } from './mockDonations';

const TABLE = 'shelterlink-donations';
const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

let ddb: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!ddb) {
    const client = new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(client);
  }
  return ddb;
}

export async function getAllDonations(): Promise<DonationRecord[]> {
  if (USE_MOCK) return MOCK_DONATIONS;

  const result = await getClient().send(new ScanCommand({ TableName: TABLE }));
  return (result.Items ?? []) as DonationRecord[];
}
