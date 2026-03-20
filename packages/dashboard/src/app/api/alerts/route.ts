import { NextRequest } from 'next/server';
import { getAllMessages, addMessage } from '@/lib/mockChatStore';
import { getMockShelters } from '@/lib/mockShelterStore';
import type { ChatMessage } from '@/types/shelter';

const USE_MOCK = process.env['USE_MOCK_DATA'] === 'true';

// Scripted mock alerts — fired at random intervals between 4s and 20s apart
const MOCK_ALERT_SCRIPT: Array<{ shelterId: string; message: string }> = [
  {
    shelterId: 'shelter-001',
    message: '🚨 Staff alert: blanket supply critically low — need immediate drop-off',
  },
  {
    shelterId: 'shelter-201',
    message: '📦 Volunteer arriving at 4pm with 30 winter coats — please have staff ready at loading dock',
  },
  {
    shelterId: 'shelter-501',
    message: '🤝 Anonymous has pledged to donate 24× canned food — delivery expected tomorrow',
  },
  {
    shelterId: 'shelter-002',
    message: '🚨 Staff alert: baby formula completely out — CRITICAL need, please respond',
  },
  {
    shelterId: 'shelter-101',
    message: '📣 Community Advocate: hygiene kit drive underway — 3 donors coordinating pickup',
  },
  {
    shelterId: 'shelter-401',
    message: '🧥 Winter coat donation confirmed — 15 coats arriving Friday morning',
  },
];

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function GET(_req: NextRequest) {
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (s: string) => new TextEncoder().encode(s);

      const sendAlert = (msg: ChatMessage, shelterName: string) => {
        if (closed) return;
        controller.enqueue(encode(`data: ${JSON.stringify({ ...msg, shelterName })}\n\n`));
      };

      const sendHeartbeat = () => {
        if (closed) return;
        controller.enqueue(encode(`: heartbeat\n\n`));
      };

      const heartbeatInterval = setInterval(sendHeartbeat, 15_000);

      if (USE_MOCK) {
        const shelters = getMockShelters();
        const shelterNameMap = Object.fromEntries(shelters.map((s) => [s.shelterId, s.name]));

        // Track which messages we've already sent to avoid re-sending on reconnect
        const sentTimestamps = new Set<string>(
          getAllMessages()
            .filter((m) => m.userType === 'ADMIN')
            .map((m) => m.timestamp)
        );

        // Fire scripted alerts at random intervals (4–20s apart), chained sequentially
        const scriptTimers: ReturnType<typeof setTimeout>[] = [];
        let accumulated = 0;
        for (const { shelterId, message } of MOCK_ALERT_SCRIPT) {
          accumulated += randomDelay(4_000, 20_000);
          const delay = accumulated;
          scriptTimers.push(
            setTimeout(() => {
              if (closed) return;
              const msg: ChatMessage = {
                roomId: shelterId,
                timestamp: new Date().toISOString(),
                senderName: 'Community Advocate',
                message,
                userType: 'ADMIN',
              };
              addMessage(msg);
              sentTimestamps.add(msg.timestamp);
              sendAlert(msg, shelterNameMap[shelterId] ?? shelterId);
            }, delay)
          );
        }

        // Also poll for any new ADMIN messages added by other routes (manual pledges, advocate tool)
        const pollInterval = setInterval(() => {
          if (closed) return;
          const all = getAllMessages();
          for (const msg of all) {
            if (msg.userType === 'ADMIN' && !sentTimestamps.has(msg.timestamp)) {
              sentTimestamps.add(msg.timestamp);
              sendAlert(msg, shelterNameMap[msg.roomId] ?? msg.roomId);
            }
          }
        }, 2_000);

        (controller as unknown as {
          _scriptTimers: ReturnType<typeof setTimeout>[];
          _pollInterval: ReturnType<typeof setInterval>;
          _heartbeatInterval: ReturnType<typeof setInterval>;
        })._scriptTimers = scriptTimers;
        (controller as unknown as { _pollInterval: ReturnType<typeof setInterval> })._pollInterval = pollInterval;
      }

      (controller as unknown as { _heartbeatInterval: ReturnType<typeof setInterval> })._heartbeatInterval = heartbeatInterval;
    },
    cancel() {
      closed = true;
      const ctrl = this as unknown as {
        _scriptTimers?: ReturnType<typeof setTimeout>[];
        _pollInterval?: ReturnType<typeof setInterval>;
        _heartbeatInterval?: ReturnType<typeof setInterval>;
      };
      ctrl._scriptTimers?.forEach(clearTimeout);
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
