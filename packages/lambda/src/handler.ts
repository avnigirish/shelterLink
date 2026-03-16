import type { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { PinpointClient, SendMessagesCommand } from '@aws-sdk/client-pinpoint';
import { Logger } from '@aws-lambda-powertools/logger';

import { parse } from './parser';
import { formatConfirmation, formatError } from './prettyPrinter';
import { lookupRegistry, maskPhone } from './registry';
import { checkRateLimit, recordUnauthorizedAttempt } from './rateLimit';

const logger = new Logger({ serviceName: 'shelter-link-update-processor' });

// Module-level clients for connection reuse across warm invocations
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const pinpointClient = new PinpointClient({});

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

async function processRecord(sqsBody: string): Promise<void> {
  // Unwrap SNS → Pinpoint event
  const snsNotification = JSON.parse(sqsBody) as SnsNotification;
  const pinpointEvent = JSON.parse(snsNotification.Message) as PinpointSmsEvent;

  const senderPhone = pinpointEvent.originationNumber;
  const smsBody = pinpointEvent.messageBody;
  const masked = maskPhone(senderPhone);

  logger.info('Inbound SMS received', { maskedPhone: masked });

  // Step 1: Rate-limit check
  const { suppressed } = await checkRateLimit(senderPhone, dynamoClient, SHELTER_TABLE);
  if (suppressed) {
    logger.info('Rate limit suppressed — no reply sent', { maskedPhone: masked });
    return;
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
    return;
  }

  // Step 3: Parse SMS
  const parseResult = parse(smsBody);
  if (!parseResult.ok) {
    logger.info('Parse failure', { maskedPhone: masked, error: parseResult.error });
    await sendSms(senderPhone, formatError(parseResult.error));
    return;
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
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
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
