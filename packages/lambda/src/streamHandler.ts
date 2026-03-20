import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';

// LOG_LEVEL is read automatically by Powertools from process.env['LOG_LEVEL']
const logger = new Logger({ serviceName: 'shelter-link-stream-handler' });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' }),
);

const CONNECTIONS_TABLE = process.env['CONNECTIONS_TABLE'] ?? '';

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
    if (!shelterRecord) {
      logger.debug('Skipping non-RECORD#CURRENT stream event', {
        eventName: record.eventName,
        keys: record.dynamodb?.Keys,
      });
      continue;
    }

    const shelterId = String(shelterRecord['shelterId'] ?? '');
    logger.info('Stream record detected', { shelterId, eventName: record.eventName });

    try {
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
    } catch (err) {
      logger.error('Failed to write pending update', {
        shelterId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Re-throw so Lambda marks this record as failed
      throw err;
    }
  }
};
