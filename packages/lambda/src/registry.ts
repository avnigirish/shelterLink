import { createHash } from 'crypto';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'shelter-link-registry' });

/**
 * Masks a phone number for safe logging.
 * Takes the last 4 digits of an E.164 number and formats as +1***XXXX.
 * e.g. +15551234 → +1***1234
 */
export function maskPhone(phone: string): string {
  const last4 = phone.slice(-4);
  return `+1***${last4}`;
}

/**
 * SHA-256 hash of the phone number with an optional salt from REGISTRY_SALT env var.
 */
export function hashPhone(phone: string): string {
  const salt = process.env.REGISTRY_SALT ?? '';
  return createHash('sha256').update(salt + phone).digest('hex');
}

/**
 * Looks up the shelter registry in DynamoDB to validate the sender.
 * Returns { authorized: true, shelterId } if found, { authorized: false } otherwise.
 */
export async function lookupRegistry(
  phone: string,
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
): Promise<{ authorized: boolean; shelterId?: string }> {
  const masked = maskPhone(phone);
  const hashed = hashPhone(phone);

  const result = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `REGISTRY#${hashed}`,
        SK: 'METADATA',
      },
    }),
  );

  if (result.Item) {
    logger.info('Registry lookup: authorized', { maskedPhone: masked, shelterId: result.Item['shelterId'] });
    return { authorized: true, shelterId: result.Item['shelterId'] as string };
  }

  logger.info('Registry lookup: unauthorized', { maskedPhone: masked });
  return { authorized: false };
}
