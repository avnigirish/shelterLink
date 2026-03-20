import type { SQSEvent, SQSBatchResponse, APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { PinpointClient, SendMessagesCommand } from '@aws-sdk/client-pinpoint';
import { Logger } from '@aws-lambda-powertools/logger';

import { parse } from './parser';
import { formatConfirmation, formatError } from './prettyPrinter';
import { lookupRegistry, maskPhone } from './registry';
import { checkRateLimit, recordUnauthorizedAttempt } from './rateLimit';

const logger = new Logger({ serviceName: 'shelter-link-update-processor' });

// Module-level clients for connection reuse across warm invocations
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' }),
);
const pinpointClient = new PinpointClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });

const SHELTER_TABLE = process.env['SHELTER_TABLE'] ?? '';
const PINPOINT_APP_ID = process.env['PINPOINT_APP_ID'] ?? '';
const ORIGINATION_NUMBER = process.env['ORIGINATION_NUMBER'] ?? '';

interface PinpointSmsEvent {
  originationNumber: string;
  messageBody: string;
  destinationNumber: string;
  messageKeyword?: string;
  messageType?: string;
}

interface SnsNotification {
  Message: string;
  [key: string]: unknown;
}

async function sendSms(toPhone: string, body: string): Promise<void> {
  // Pinpoint is disabled pending sandbox approval — skip silently
  if (!PINPOINT_APP_ID || PINPOINT_APP_ID === 'PENDING') {
    logger.info('Pinpoint disabled — skipping SMS reply', { body });
    return;
  }
  await pinpointClient.send(
    new SendMessagesCommand({
      ApplicationId: PINPOINT_APP_ID,
      MessageRequest: {
        Addresses: {
          [toPhone]: { ChannelType: 'SMS' },
        },
        MessageConfiguration: {
          SMSMessage: {
            Body: body,
            OriginationNumber: ORIGINATION_NUMBER,
          },
        },
      },
    }),
  );
}

/**
 * Core processing logic shared by both SQS and Function URL paths.
 * Returns the confirmation string on success, or null for suppressed/unauthorized/parse-failure.
 */
async function processUpdate(senderPhone: string, smsBody: string): Promise<string | null> {
  const masked = maskPhone(senderPhone);

  logger.info('Inbound SMS received', { maskedPhone: masked });

  // Step 1: Rate-limit check
  const { suppressed } = await checkRateLimit(senderPhone, dynamoClient, SHELTER_TABLE);
  if (suppressed) {
    logger.info('Rate limit suppressed — no reply sent', { maskedPhone: masked });
    return null;
  }

  // Step 2: Registry check
  const { authorized, shelterId } = await lookupRegistry(senderPhone, dynamoClient, SHELTER_TABLE);
  if (!authorized) {
    logger.info('Unauthorized sender', { maskedPhone: masked });
    await recordUnauthorizedAttempt(senderPhone, dynamoClient, SHELTER_TABLE);
    await sendSms(
      senderPhone,
      'Your number is not authorized to submit updates. To register, contact your shelter administrator.',
    );
    return null;
  }

  // Step 3: Parse SMS
  const parseResult = parse(smsBody);
  if (!parseResult.ok) {
    logger.info('Parse failure', { maskedPhone: masked, error: parseResult.error });
    await sendSms(senderPhone, formatError(parseResult.error));
    return null;
  }

  const record = parseResult.record;
  const updatedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  const baseItem = {
    shelterId,
    beds: record.beds,
    capacity: record.capacity,
    status: record.status,
    needsList: record.needsList,
    updatedAt,
  };

  // Step 4: Write RECORD#CURRENT and LOG#<timestamp> to DynamoDB
  await dynamoClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: SHELTER_TABLE,
            Item: {
              PK: `SHELTER#${shelterId}`,
              SK: 'RECORD#CURRENT',
              ...baseItem,
            },
          },
        },
        {
          Put: {
            TableName: SHELTER_TABLE,
            Item: {
              PK: `SHELTER#${shelterId}`,
              SK: `LOG#${updatedAt}`,
              ...baseItem,
              ttl,
            },
          },
        },
      ],
    }),
  );

  logger.info('DynamoDB write complete', { maskedPhone: masked, shelterId, updatedAt });

  // Step 5: Send confirmation SMS
  const confirmation = formatConfirmation(record);
  await sendSms(senderPhone, confirmation);

  logger.info('Confirmation SMS sent', { maskedPhone: masked, shelterId });

  return confirmation;
}

async function processRecord(sqsBody: string): Promise<void> {
  // Unwrap SNS → Pinpoint event
  const snsNotification = JSON.parse(sqsBody) as SnsNotification;
  const pinpointEvent = JSON.parse(snsNotification.Message) as PinpointSmsEvent;
  await processUpdate(pinpointEvent.originationNumber, pinpointEvent.messageBody);
}

function isFunctionUrlEvent(event: SQSEvent | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 {
  return 'requestContext' in event && 'http' in (event as APIGatewayProxyEventV2).requestContext;
}

export const handler = async (
  event: SQSEvent | APIGatewayProxyEventV2,
): Promise<SQSBatchResponse | APIGatewayProxyResultV2> => {
  // ── Function URL path ──────────────────────────────────────────────────────
  if (isFunctionUrlEvent(event)) {
    const rawBody = event.body ?? '';
    let phone: string;
    let body: string;

    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      phone = typeof parsed['phone'] === 'string' ? parsed['phone'] : '';
      body = typeof parsed['body'] === 'string' ? parsed['body'] : '';
    } catch {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) };
    }

    if (!phone || !body) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing required fields: phone, body' }) };
    }

    try {
      const confirmation = await processUpdate(phone, body);
      if (confirmation === null) {
        return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Request suppressed or unauthorized' }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, confirmation }) };
    } catch (err) {
      logger.error('Function URL processing error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Internal server error' }) };
    }
  }

  // ── SQS path ───────────────────────────────────────────────────────────────
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record.body);
    } catch (err) {
      logger.error('Failed to process SQS record', {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
