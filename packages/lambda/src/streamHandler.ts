import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PinpointClient } from '@aws-sdk/client-pinpoint';
import type { DynamoDBStreamEvent, DynamoDBRecord, DynamoDBBatchResponse } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { evaluateTriggers, broadcastAlerts } from './broadcastService';
import type { SubscriptionRecord } from './types';

// LOG_LEVEL is read automatically by Powertools from process.env['LOG_LEVEL']
const logger = new Logger({ serviceName: 'shelter-link-stream-handler' });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' }),
);
const pinpointClient = new PinpointClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });

const CONNECTIONS_TABLE = process.env['CONNECTIONS_TABLE'] ?? '';
const SHELTER_TABLE = process.env['SHELTER_TABLE'] ?? '';

function extractImage(record: DynamoDBRecord, imageKey: 'NewImage' | 'OldImage'): Record<string, unknown> | null {
  const image = record.dynamodb?.[imageKey];
  if (!image) return null;
  return unmarshall(image as Record<string, AttributeValue>);
}

async function queryActiveSubscribers(shelterId: string): Promise<SubscriptionRecord[]> {
  const subscribers: SubscriptionRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new QueryCommand({
      TableName: SHELTER_TABLE,
      IndexName: 'subscribers-by-shelter',
      KeyConditionExpression: 'shelterId = :sid AND #st = :active',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':sid': shelterId, ':active': 'ACTIVE' },
      ExclusiveStartKey: lastKey as Record<string, AttributeValue> | undefined,
    }));

    for (const item of result.Items ?? []) {
      subscribers.push(item as unknown as SubscriptionRecord);
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return subscribers;
}

export const handler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const sequenceNumber = record.dynamodb?.SequenceNumber ?? '';

    try {
      if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') continue;

      const newImage = extractImage(record, 'NewImage');
      if (!newImage || newImage['SK'] !== 'RECORD#CURRENT') {
        logger.debug('Skipping non-RECORD#CURRENT stream event', {
          eventName: record.eventName,
          keys: record.dynamodb?.Keys,
        });
        continue;
      }

      const shelterId = String(newImage['shelterId'] ?? '');
      logger.info('Stream record detected', { shelterId, eventName: record.eventName });

      // Write SSE update payload
      await ddb.send(new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: {
          PK: `UPDATE#${shelterId}`,
          SK: new Date().toISOString(),
          shelterId,
          payload: newImage,
          ttl: Math.floor(Date.now() / 1000) + 60,
        },
      }));
      logger.info('Pending update written', { shelterId });

      // Broadcast alert fan-out
      const oldImage = extractImage(record, 'OldImage');
      const trigger = evaluateTriggers(newImage, oldImage);

      if (!trigger) {
        logger.info('No broadcast trigger condition met', { shelterId });
        continue;
      }

      const subscribers = await queryActiveSubscribers(shelterId);
      if (subscribers.length === 0) {
        logger.info('No active subscribers for shelter', { shelterId, triggerType: trigger.type });
        continue;
      }

      await broadcastAlerts(trigger, subscribers, pinpointClient, logger);

    } catch (err) {
      logger.error('Failed to process stream record', {
        sequenceNumber,
        error: err instanceof Error ? err.message : String(err),
      });
      batchItemFailures.push({ itemIdentifier: sequenceNumber });
    }
  }

  return { batchItemFailures };
};
