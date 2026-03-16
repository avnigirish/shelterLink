import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';

const logger = new Logger({ serviceName: 'stream-handler' });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

function extractShelterRecord(record: DynamoDBRecord): Record<string, unknown> | null {
  const newImage = record.dynamodb?.NewImage;
  if (!newImage) return null;
  const item = unmarshall(newImage as Record<string, AttributeValue>);
  if (item['SK'] !== 'RECORD#CURRENT') return null;
  return item;
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') continue;

    const shelterRecord = extractShelterRecord(record);
    if (!shelterRecord) continue;

    const shelterId = String(shelterRecord['shelterId'] ?? '');
    logger.info('Stream record detected', { shelterId, eventName: record.eventName });

    // Write a pending update notification to the connections table
    // The SSE route polls this table and pushes to connected clients
    await ddb.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        PK: `UPDATE#${shelterId}`,
        SK: new Date().toISOString(),
        shelterId,
        payload: shelterRecord,
        ttl: Math.floor(Date.now() / 1000) + 60, // expire after 60s
      },
    }));

    logger.info('Pending update written', { shelterId });
  }
};
