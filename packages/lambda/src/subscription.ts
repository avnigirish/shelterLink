import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { hashPhone, maskPhone } from './registry';

const logger = new Logger({ serviceName: 'shelter-link-subscription' });

/**
 * Sets all subscription records for the given phone number to UNSUBSCRIBED.
 * Queries PK=SUBSCRIBER#<hash> and batch-updates each record.
 */
export async function unsubscribePhone(
  phone: string,
  ddbClient: DynamoDBDocumentClient,
  table: string,
): Promise<void> {
  const masked = maskPhone(phone);
  const hashed = hashPhone(phone);
  const pk = `SUBSCRIBER#${hashed}`;
  const updatedAt = new Date().toISOString();

  const result = await ddbClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
  }));

  const items = result.Items ?? [];
  if (items.length === 0) {
    logger.info('Unsubscribe: no records found', { maskedPhone: masked });
    return;
  }

  for (const item of items) {
    await ddbClient.send(new UpdateCommand({
      TableName: table,
      Key: { PK: pk, SK: item['SK'] as string },
      UpdateExpression: 'SET #st = :unsubscribed, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':unsubscribed': 'UNSUBSCRIBED', ':updatedAt': updatedAt },
    }));
  }

  logger.info('Unsubscribed phone from all shelters', { maskedPhone: masked, count: items.length });
}

/**
 * Sets all subscription records for the given phone number back to ACTIVE.
 */
export async function resubscribePhone(
  phone: string,
  ddbClient: DynamoDBDocumentClient,
  table: string,
): Promise<void> {
  const masked = maskPhone(phone);
  const hashed = hashPhone(phone);
  const pk = `SUBSCRIBER#${hashed}`;
  const updatedAt = new Date().toISOString();

  const result = await ddbClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
  }));

  const items = result.Items ?? [];
  if (items.length === 0) {
    logger.info('Resubscribe: no records found', { maskedPhone: masked });
    return;
  }

  for (const item of items) {
    await ddbClient.send(new UpdateCommand({
      TableName: table,
      Key: { PK: pk, SK: item['SK'] as string },
      UpdateExpression: 'SET #st = :active, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':active': 'ACTIVE', ':updatedAt': updatedAt },
    }));
  }

  logger.info('Resubscribed phone to all shelters', { maskedPhone: masked, count: items.length });
}
