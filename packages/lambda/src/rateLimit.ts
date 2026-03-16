import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { hashPhone, maskPhone } from './registry';

const logger = new Logger({ serviceName: 'shelter-link-ratelimit' });

const ATTEMPT_THRESHOLD = 5;
const TTL_WINDOW_SECONDS = 600;    // 10 minutes
const SUPPRESS_DURATION_SECONDS = 3600; // 60 minutes

/**
 * Checks whether the given phone number is currently suppressed due to
 * exceeding the unauthorized attempt threshold.
 */
export async function checkRateLimit(
  phone: string,
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
): Promise<{ suppressed: boolean }> {
  const masked = maskPhone(phone);
  const hashed = hashPhone(phone);
  const now = Math.floor(Date.now() / 1000);

  const result = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `RATELIMIT#${hashed}`,
        SK: 'ATTEMPTS',
      },
    }),
  );

  if (result.Item && typeof result.Item['suppressedUntil'] === 'number' && result.Item['suppressedUntil'] > now) {
    logger.info('Rate limit: suppressed', { maskedPhone: masked, suppressedUntil: result.Item['suppressedUntil'] });
    return { suppressed: true };
  }

  logger.info('Rate limit: not suppressed', { maskedPhone: masked });
  return { suppressed: false };
}

/**
 * Records an unauthorized attempt for the given phone number.
 * Increments the attempt count and sets suppression if the threshold is reached.
 * Returns the new attempt count.
 */
export async function recordUnauthorizedAttempt(
  phone: string,
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
): Promise<number> {
  const masked = maskPhone(phone);
  const hashed = hashPhone(phone);
  const now = Math.floor(Date.now() / 1000);
  const newTtl = now + TTL_WINDOW_SECONDS;

  const result = await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `RATELIMIT#${hashed}`,
        SK: 'ATTEMPTS',
      },
      UpdateExpression: 'ADD #count :inc SET #ttl = :ttl',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':ttl': newTtl,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );

  const newCount: number = (result.Attributes?.['count'] as number) ?? 1;

  if (newCount >= ATTEMPT_THRESHOLD) {
    const suppressedUntil = now + SUPPRESS_DURATION_SECONDS;
    await dynamoClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `RATELIMIT#${hashed}`,
          SK: 'ATTEMPTS',
        },
        UpdateExpression: 'SET suppressedUntil = :suppressedUntil',
        ExpressionAttributeValues: {
          ':suppressedUntil': suppressedUntil,
        },
      }),
    );
    logger.info('Rate limit: suppression set', { maskedPhone: masked, count: newCount, suppressedUntil });
  } else {
    logger.info('Rate limit: attempt recorded', { maskedPhone: masked, count: newCount });
  }

  return newCount;
}
