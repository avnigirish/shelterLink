import { NextRequest } from 'next/server';
import { getAllMessages, addMessage } from '@/lib/mockChatStore';
import { getMockShelters } from '@/lib/mockShelterStore';
import type { ChatMessage } from '@/types/shelter';

const USE_MOCK = process.env['USE_MOCK_DATA'] === 'true';

// Scripted mock alerts — fired at random intervals between 8s and 22s apart
// 16 alerts across all shelters — all fire within ~5 minutes
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
  {
    shelterId: 'shelter-502',
    message: '🚨 Capacity update: Miriam\'s Kitchen now FULL — redirecting new arrivals to Central Union Mission',
  },
  {
    shelterId: 'shelter-301',
    message: '📦 Hygiene kit donation incoming — 40 kits from local church, arriving Saturday 10am',
  },
  {
    shelterId: 'shelter-102',
    message: '🤝 Eva\'s Village: 3 volunteers confirmed for weekend meal service — thank you!',
  },
  {
    shelterId: 'shelter-403',
    message: '🚨 Arundel House at capacity — warm clothing still urgently needed, drop-off accepted at side entrance',
  },
  {
    shelterId: 'shelter-202',
    message: '📣 Covenant House NY: school supply drive ends Friday — backpacks and notebooks most needed',
  },
  {
    shelterId: 'shelter-303',
    message: '🚨 ACTS shelter FULL — families with children being referred to HomeFront in Lawrenceville',
  },
  {
    shelterId: 'shelter-503',
    message: '🤝 N Street Village: gift card drive raised $400 this week — residents grateful',
  },
  {
    shelterId: 'shelter-104',
    message: '🚨 HomeFront Family Shelter: baby formula critically low — any amount helps',
  },
  {
    shelterId: 'shelter-402',
    message: '📦 Montgomery County shelter: diaper donation from community drive arriving Monday morning',
  },
  {
    shelterId: 'shelter-302',
    message: '📣 HomeAgain Richmond: work boot drive underway — sizes 9–12 most needed, drop off at front desk',
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

        // Fire scripted alerts at random intervals (8–22s apart), chained sequentially
        const scriptTimers: ReturnType<typeof setTimeout>[] = [];
        let accumulated = 0;
        for (const { shelterId, message } of MOCK_ALERT_SCRIPT) {
          accumulated += randomDelay(8_000, 22_000);
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
