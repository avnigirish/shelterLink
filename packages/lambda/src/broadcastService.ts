import { PinpointClient, SendMessagesCommand } from '@aws-sdk/client-pinpoint';
import { Logger } from '@aws-lambda-powertools/logger';
import type { AlertTrigger, AlertTriggerType, SubscriptionRecord } from './types';
import { maskPhone } from './registry';

// ── Trigger evaluation ────────────────────────────────────────────────────────

interface DynamoNeedsItem {
  item: { S: string };
  priority: { S: string };
  fulfilled?: { BOOL: boolean };
}

interface DynamoImage {
  SK?: { S: string };
  status?: { S: string };
  shelterName?: { S: string };
  shelterId?: { S: string };
  beds?: { N: string };
  capacity?: { N: string };
  needsList?: { L: DynamoNeedsItem[] };
}

function extractStatus(image: Record<string, unknown>): string | null {
  const img = image as DynamoImage;
  return img.status?.S ?? null;
}

function extractNeedsItems(image: Record<string, unknown>): string[] {
  const img = image as DynamoImage;
  if (!img.needsList?.L) return [];
  return img.needsList.L
    .filter((n) => n.priority?.S === 'CRITICAL' && !n.fulfilled?.BOOL)
    .map((n) => n.item?.S ?? '')
    .filter(Boolean);
}

function extractString(image: Record<string, unknown>, key: string): string {
  const img = image as Record<string, { S?: string }>;
  return img[key]?.S ?? '';
}

function extractNumber(image: Record<string, unknown>, key: string): number | undefined {
  const img = image as Record<string, { N?: string }>;
  const val = img[key]?.N;
  return val !== undefined ? Number(val) : undefined;
}

/**
 * Evaluates DynamoDB Streams NEW_IMAGE / OLD_IMAGE to determine if a broadcast
 * trigger condition is met. Returns null if no trigger applies.
 * Pure function — no I/O, no side effects.
 */
export function evaluateTriggers(
  newImage: Record<string, unknown>,
  oldImage: Record<string, unknown> | null,
): AlertTrigger | null {
  const newStatus = extractStatus(newImage);
  const oldStatus = oldImage ? extractStatus(oldImage) : null;
  const shelterId = extractString(newImage, 'shelterId');
  const shelterName = extractString(newImage, 'shelterName') || shelterId;
  const beds = extractNumber(newImage, 'beds');
  const capacity = extractNumber(newImage, 'capacity');

  // Status transition: → FULL
  if (newStatus === 'FULL' && oldStatus !== 'FULL') {
    return { type: 'STATUS_FULL', shelterId, shelterName, beds, capacity };
  }

  // Status transition: → CLOSED
  if (newStatus === 'CLOSED' && oldStatus !== 'CLOSED') {
    return { type: 'STATUS_CLOSED', shelterId, shelterName };
  }

  // Recovery: FULL or CLOSED → OPEN
  if (newStatus === 'OPEN' && (oldStatus === 'FULL' || oldStatus === 'CLOSED')) {
    return { type: 'STATUS_OPEN', shelterId, shelterName, beds, capacity };
  }

  // New CRITICAL needs items
  const newCritical = extractNeedsItems(newImage);
  const oldCritical = oldImage ? new Set(extractNeedsItems(oldImage)) : new Set<string>();
  const addedCritical = newCritical.filter((item) => !oldCritical.has(item));

  if (addedCritical.length > 0) {
    return { type: 'CRITICAL_NEED', shelterId, shelterName, newCriticalItems: addedCritical };
  }

  return null;
}

// ── Message formatting ────────────────────────────────────────────────────────

const OPT_OUT_SUFFIX = ' Reply STOP to unsubscribe.';
const MAX_SMS_LENGTH = 160;

/**
 * Formats an outbound SMS alert message for the given trigger.
 * Truncates shelter name if the message would exceed 160 characters.
 * Always ends with "Reply STOP to unsubscribe."
 */
export function formatAlertMessage(trigger: AlertTrigger): string {
  const suffix = OPT_OUT_SUFFIX;

  function build(name: string): string {
    switch (trigger.type) {
      case 'STATUS_FULL':
        return `ShelterLink Alert: ${name} is now FULL (${trigger.beds ?? '?'}/${trigger.capacity ?? '?'} beds).${suffix}`;
      case 'STATUS_CLOSED':
        return `ShelterLink Alert: ${name} is now CLOSED.${suffix}`;
      case 'STATUS_OPEN':
        return `ShelterLink Alert: ${name} has reopened — ${trigger.beds ?? '?'}/${trigger.capacity ?? '?'} beds available.${suffix}`;
      case 'CRITICAL_NEED': {
        const items = (trigger.newCriticalItems ?? []).join(', ');
        return `ShelterLink Alert: ${name} urgently needs ${items}.${suffix}`;
      }
    }
  }

  const full = build(trigger.shelterName);
  if (full.length <= MAX_SMS_LENGTH) return full;

  // Truncate shelter name to fit within 160 chars
  // Binary-search for the longest name that fits
  let lo = 0;
  let hi = trigger.shelterName.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (build(trigger.shelterName.slice(0, mid)).length <= MAX_SMS_LENGTH) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return build(trigger.shelterName.slice(0, lo));
}

// ── Broadcast delivery ────────────────────────────────────────────────────────

const PINPOINT_APP_ID = process.env['PINPOINT_APP_ID'] ?? '';
const ORIGINATION_NUMBER = process.env['ORIGINATION_NUMBER'] ?? '';

/**
 * Dispatches SMS to all provided ACTIVE subscribers via Pinpoint.
 * Logs WARN per failed delivery; never throws.
 * Skips silently if PINPOINT_APP_ID is absent or 'PENDING'.
 */
export async function broadcastAlerts(
  trigger: AlertTrigger,
  subscribers: SubscriptionRecord[],
  pinpointClient: PinpointClient,
  logger: Logger,
): Promise<void> {
  if (!PINPOINT_APP_ID || PINPOINT_APP_ID === 'PENDING') {
    logger.info('Pinpoint disabled — skipping broadcast', {
      shelterId: trigger.shelterId,
      triggerType: trigger.type,
    });
    return;
  }

  const active = subscribers.filter((s) => s.status === 'ACTIVE');
  if (active.length === 0) {
    logger.info('No active subscribers — skipping broadcast', {
      shelterId: trigger.shelterId,
      triggerType: trigger.type,
    });
    return;
  }

  const messageBody = formatAlertMessage(trigger);
  let successCount = 0;

  for (const subscriber of active) {
    try {
      await pinpointClient.send(
        new SendMessagesCommand({
          ApplicationId: PINPOINT_APP_ID,
          MessageRequest: {
            Addresses: { [subscriber.phone]: { ChannelType: 'SMS' } },
            MessageConfiguration: {
              SMSMessage: {
                Body: messageBody,
                OriginationNumber: ORIGINATION_NUMBER,
              },
            },
          },
        }),
      );
      successCount++;
    } catch (err) {
      logger.warn('Broadcast delivery failed for subscriber', {
        shelterId: trigger.shelterId,
        triggerType: trigger.type,
        maskedPhone: maskPhone(subscriber.phone),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Broadcast dispatched', {
    shelterId: trigger.shelterId,
    triggerType: trigger.type,
    recipientCount: successCount,
  });
}
