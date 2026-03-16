import { NextRequest } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { MOCK_SHELTERS } from '@/lib/mockData';
import type { ShelterRecord } from '@/types/shelter';

const USE_MOCK = !process.env.SHELTER_TABLE || process.env.USE_MOCK_DATA === 'true';
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

let ddb: DynamoDBDocumentClient | null = null;
function getClient() {
  if (!ddb) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(client);
  }
  return ddb;
}

function mockUpdate(): ShelterRecord {
  const shelter = { ...MOCK_SHELTERS[Math.floor(Math.random() * MOCK_SHELTERS.length)] };
  const delta = Math.random() > 0.5 ? 1 : -1;
  shelter.beds = Math.max(0, Math.min(shelter.capacity, shelter.beds + delta));
  shelter.updatedAt = new Date().toISOString();
  return shelter;
}

async function pollDynamoUpdates(): Promise<ShelterRecord[]> {
  if (!CONNECTIONS_TABLE) return [];

  const result = await getClient().send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    KeyConditionExpression: 'begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'UPDATE#' },
  }));

  const items = result.Items ?? [];
  const records: ShelterRecord[] = [];

  for (const item of items) {
    if (item.data) {
      records.push(item.data as ShelterRecord);
    }
    // Delete the item after reading
    await getClient().send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { PK: item.PK, SK: item.SK },
    }));
  }

  return records;
}

export async function GET(_req: NextRequest) {
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (s: string) => new TextEncoder().encode(s);

      const sendEvent = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const sendHeartbeat = () => {
        if (closed) return;
        controller.enqueue(encode(`: heartbeat\n\n`));
      };

      // Heartbeat every 15s
      const heartbeatInterval = setInterval(sendHeartbeat, 15_000);

      if (USE_MOCK) {
        // Initial snapshot after 1s
        setTimeout(() => sendEvent(mockUpdate()), 1_000);

        // Mock mode: emit a random shelter update every 8s
        const mockInterval = setInterval(() => {
          sendEvent(mockUpdate());
        }, 8_000);

        (controller as unknown as { _mockInterval: ReturnType<typeof setInterval> })._mockInterval = mockInterval;
      } else {
        // Production mode: poll DynamoDB connections table every 3s
        const pollInterval = setInterval(async () => {
          if (closed) return;
          try {
            const updates = await pollDynamoUpdates();
            for (const update of updates) {
              sendEvent(update);
            }
          } catch (err) {
            console.error('[SSE] DynamoDB poll error:', err);
          }
        }, 3_000);

        (controller as unknown as { _pollInterval: ReturnType<typeof setInterval> })._pollInterval = pollInterval;
      }

      (controller as unknown as { _heartbeatInterval: ReturnType<typeof setInterval> })._heartbeatInterval = heartbeatInterval;
    },
    cancel() {
      closed = true;
      const ctrl = this as unknown as {
        _mockInterval?: ReturnType<typeof setInterval>;
        _pollInterval?: ReturnType<typeof setInterval>;
        _heartbeatInterval?: ReturnType<typeof setInterval>;
      };
      clearInterval(ctrl._mockInterval);
      clearInterval(ctrl._pollInterval);
      clearInterval(ctrl._heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
