import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getAllShelters, getShelterById } from '@/lib/db';
import type { ShelterRecord } from '@/types/shelter';

const MODEL_ID = 'amazon.nova-pro-v1:0';

const bedrock = new BedrockRuntimeClient({
  region: process.env['BEDROCK_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1',
});

// Simple in-memory rate limiter (resets on cold start — good enough for demo)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function buildShelterContext(shelters: ShelterRecord[]): string {
  return shelters
    .map((s) => {
      const critical = s.needsList.filter((n) => !n.fulfilled && n.priority === 'CRITICAL').map((n) => n.item);
      const high = s.needsList.filter((n) => !n.fulfilled && n.priority === 'HIGH').map((n) => n.item);
      const inventoryItems = Object.entries(s.inventory ?? {})
        .map(([item, qty]) => `${item}: ${qty}`)
        .join(', ');
      return [
        `${s.name} (${s.state}) — ${s.status} — ${s.beds}/${s.capacity} beds available`,
        critical.length ? `  CRITICAL needs: ${critical.join(', ')}` : '',
        high.length ? `  HIGH needs: ${high.join(', ')}` : '',
        inventoryItems ? `  Inventory: ${inventoryItems}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function buildSystemPrompt(shelterContext: string): string {
  return `You are the ShelterLink Community Advocate — an empathetic, grounded, and action-oriented assistant helping volunteers and donors make the most impact.

Your mission: connect people with shelters that need them most, right now.

CURRENT SHELTER DATA (as of ${new Date().toUTCString()}):
${shelterContext}

CAPABILITIES:
1. Suggest the best shelter(s) for a specific donation item — rank by CRITICAL first, then HIGH
2. Summarize what's happening at a specific shelter based on its current needs and inventory
3. Guide new users through how ShelterLink works and the Build for Impact mission
4. Explain what "critical" vs "high" priority needs mean in human terms

RESPONSE RULES:
- Be empathetic, grounded, and action-oriented
- Every response MUST end with a specific, concrete next step
- Only reference shelters listed in the data above — never fabricate names, bed counts, or needs
- Keep responses concise — 3–5 sentences maximum
- Never use corporate jargon or vague advice
- If asked about something outside shelter coordination, gently redirect to how you can help with donations or volunteering`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let message: string;
  let shelterId: string | undefined;
  let context: 'home' | 'shelter';

  try {
    const body = await req.json() as { message?: unknown; shelterId?: unknown; context?: unknown };
    if (typeof body.message !== 'string' || !body.message.trim()) {
      return new Response(JSON.stringify({ error: 'message is required' }), { status: 400 });
    }
    message = body.message.trim();
    shelterId = typeof body.shelterId === 'string' ? body.shelterId : undefined;
    context = body.context === 'shelter' ? 'shelter' : 'home';
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  // Fetch shelter data
  let shelters: ShelterRecord[];
  try {
    if (context === 'shelter' && shelterId) {
      const s = await getShelterById(shelterId);
      shelters = s ? [s] : await getAllShelters();
    } else {
      shelters = await getAllShelters();
    }
  } catch {
    shelters = [];
  }

  const shelterContext = buildShelterContext(shelters);
  const systemPrompt = buildSystemPrompt(shelterContext);

  // Nova Pro request format
  const requestBody = {
    inferenceConfig: { max_new_tokens: 512, temperature: 0.4 },
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: message }] }],
  };

  try {
    const command = new InvokeModelWithResponseStreamCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await bedrock.send(command);

    // Stream the response back as SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of response.body ?? []) {
            if (chunk.chunk?.bytes) {
              const decoded = new TextDecoder().decode(chunk.chunk.bytes);
              const parsed = JSON.parse(decoded) as {
                contentBlockDelta?: { delta?: { text?: string } };
              };
              const text = parsed.contentBlockDelta?.delta?.text;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "\n\nI'm having trouble connecting right now. Please browse the shelter list directly to find where your help is needed most." })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : 'UnknownError';
    console.error('[advocate] Bedrock error:', name, message);
    const fallback = `I'm having trouble connecting right now (${name}). Please browse the shelter list directly to find where your help is needed most.`;
    return new Response(JSON.stringify({ text: fallback, debug: message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
