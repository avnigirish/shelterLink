import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Tool,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getAllShelters, getShelterById } from '@/lib/db';
import type { ShelterRecord } from '@/types/shelter';
import { MOCK_MESSAGES } from '@/lib/mockChat';
import { randomUUID } from 'crypto';

const MODEL_ID = 'amazon.nova-pro-v1:0';

const bedrock = new BedrockRuntimeClient({
  region: process.env['BEDROCK_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1',
});

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })
);

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
        `${s.name} (ID: ${s.shelterId}, ${s.state}) — ${s.status} — ${s.beds}/${s.capacity} beds available`,
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

Your mission: connect people with shelters that need them most, right now. You can also take direct action on behalf of users using your tools.

CURRENT SHELTER DATA (as of ${new Date().toUTCString()}):
${shelterContext}

CAPABILITIES:
1. Suggest the best shelter(s) for a specific donation item — rank by CRITICAL first, then HIGH — answer with TEXT only
2. Summarize what's happening at a specific shelter based on its current needs and inventory — answer with TEXT only
3. Guide new users through how ShelterLink works and the Build for Impact mission — answer with TEXT only
4. Use PledgeTool ONLY when the user has explicitly confirmed they want to pledge a donation AND you have already told them which shelter
5. Use AlertTool ONLY when the user has explicitly asked to send a message to a shelter

TOOL USE RULES:
- "Where should I go?" = TEXT answer (do NOT call PledgeTool)
- "Which shelter needs blankets?" = TEXT answer (do NOT call PledgeTool)
- "I have blankets to donate" = TEXT answer recommending shelters (do NOT call PledgeTool yet)
- "Yes, pledge my blankets to that shelter" = call PledgeTool
- "Tell them I'm coming" = call AlertTool

RESPONSE RULES:
- Be empathetic, grounded, and action-oriented
- Every response MUST end with a specific, concrete next step
- Only reference shelters listed in the data above — never fabricate names, bed counts, or needs
- Keep responses concise — 3–5 sentences maximum
- When you use a tool, confirm the action clearly and tell the user what happens next
- Never use corporate jargon or vague advice`;
}

// Tool definitions
const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'PledgeTool',
      description: 'Create a donation pledge for a specific shelter and item. ONLY use this when the user has EXPLICITLY confirmed they want to donate and has provided a specific item AND you have already told them which shelter to go to. Do NOT use this for questions like "where should I go?" or "which shelter needs X?" — those are information requests, answer them with text only.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            shelterId: { type: 'string', description: 'The shelter ID from the shelter data above' },
            item: { type: 'string', description: 'The item being donated (e.g., "winter coats", "blankets")' },
            quantity: { type: 'number', description: 'Estimated quantity (default 1 if not specified)' },
            donorName: { type: 'string', description: 'Donor name or "Anonymous" if not provided' },
          },
          required: ['shelterId', 'item'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'AlertTool',
      description: 'Post a coordination message to a shelter\'s community chat. ONLY use this when the user has EXPLICITLY asked to notify or message a shelter (e.g., "Let them know I\'m coming", "Tell the shelter I have supplies"). Do NOT use this for general questions.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            shelterId: { type: 'string', description: 'The shelter ID to post to' },
            message: { type: 'string', description: 'The coordination message to post to the shelter chat' },
          },
          required: ['shelterId', 'message'],
        },
      },
    },
  },
];

// Tool executors
async function executePledgeTool(input: Record<string, unknown>): Promise<string> {
  const shelterId = String(input['shelterId'] ?? '');
  const item = String(input['item'] ?? '');
  const quantity = typeof input['quantity'] === 'number' ? input['quantity'] : 1;
  const donorName = String(input['donorName'] ?? 'Anonymous');
  const pledgeId = randomUUID();
  const now = new Date().toISOString();

  const donationsTable = process.env['DONATIONS_TABLE'] ?? 'shelterlink-donations';

  if (process.env['USE_MOCK_DATA'] === 'true') {
    // Mock mode — skip DynamoDB write, return simulated confirmation
    return JSON.stringify({ pledgeId, shelterId, item, quantity, donorName, status: 'confirmed', createdAt: now, mock: true });
  }

  await ddb.send(new PutCommand({
    TableName: donationsTable,
    Item: {
      PK: `USER#anonymous`,
      SK: `DONATION#${pledgeId}`,
      pledgeId,
      shelterId,
      item,
      quantity,
      donorName,
      status: 'pending',
      createdAt: now,
    },
  }));

  return JSON.stringify({ pledgeId, shelterId, item, quantity, donorName, status: 'confirmed', createdAt: now });
}

async function executeAlertTool(input: Record<string, unknown>): Promise<string> {
  const shelterId = String(input['shelterId'] ?? '');
  const message = String(input['message'] ?? '');
  const timestamp = Date.now();

  const chatTable = process.env['CHAT_TABLE'] ?? 'shelterlink-chat';

  if (process.env['USE_MOCK_DATA'] === 'true') {
    MOCK_MESSAGES.push({
      roomId: shelterId,
      timestamp: new Date(timestamp).toISOString(),
      senderName: 'Community Advocate',
      message,
      userType: 'ADMIN',
    });
    return JSON.stringify({ shelterId, message, status: 'posted', timestamp, mock: true });
  }

  await ddb.send(new PutCommand({
    TableName: chatTable,
    Item: {
      PK: `ROOM#${shelterId}`,
      SK: `MSG#${timestamp}`,
      message,
      senderName: 'Community Advocate',
      userType: 'advocate',
      createdAt: new Date(timestamp).toISOString(),
    },
  }));

  return JSON.stringify({ shelterId, message, status: 'posted', timestamp });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let userMessage: string;
  let shelterId: string | undefined;
  let context: 'home' | 'shelter';
  let history: Array<{ role: 'user' | 'advocate'; text: string }> = [];

  try {
    const body = await req.json() as { message?: unknown; shelterId?: unknown; context?: unknown; history?: unknown };
    if (typeof body.message !== 'string' || !body.message.trim()) {
      return new Response(JSON.stringify({ error: 'message is required' }), { status: 400 });
    }
    userMessage = body.message.trim();
    shelterId = typeof body.shelterId === 'string' ? body.shelterId : undefined;
    context = body.context === 'shelter' ? 'shelter' : 'home';
    if (Array.isArray(body.history)) {
      history = (body.history as Array<{ role?: unknown; text?: unknown }>)
        .filter((m) => (m.role === 'user' || m.role === 'advocate') && typeof m.text === 'string' && m.text.trim())
        .map((m) => ({ role: m.role as 'user' | 'advocate', text: String(m.text) }))
        .slice(-10); // keep last 10 turns to avoid token bloat
    }
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

  // Build messages with conversation history
  const messages: Message[] = [
    // Interleave history as alternating user/assistant turns
    ...history.map((m): Message => ({
      role: m.role === 'advocate' ? 'assistant' : 'user',
      content: [{ text: m.text }],
    })),
    { role: 'user', content: [{ text: userMessage }] },
  ];

  try {
    let finalText = '';
    let toolUsed: string | undefined;

    // Agentic loop: run until model stops calling tools (max 3 iterations)
    for (let i = 0; i < 3; i++) {
      const command = new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages,
        toolConfig: { tools: TOOLS },
        inferenceConfig: { maxTokens: 512, temperature: 0.4 },
      });

      const response = await bedrock.send(command);
      const output = response.output?.message;
      if (!output) break;

      messages.push(output);

      // Check stop reason
      if (response.stopReason === 'end_turn') {
        // Extract final text, stripping any <thinking> blocks the model may emit
        for (const block of output.content ?? []) {
          if ('text' in block && block.text) {
            finalText = block.text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
          }
        }
        break;
      }

      if (response.stopReason === 'tool_use') {
        // Execute each tool call
        const toolResults: ContentBlock[] = [];

        for (const block of output.content ?? []) {
          if (!('toolUse' in block) || !block.toolUse) continue;
          const { toolUseId, name, input } = block.toolUse;
          const toolInput = (input ?? {}) as Record<string, unknown>;

          let result: string;
          try {
            if (name === 'PledgeTool') {
              result = await executePledgeTool(toolInput);
              toolUsed = 'pledge';
              // Auto-post pledge notification to community chat
              try {
                const pledgeData = JSON.parse(result) as { shelterId?: string; item?: string; quantity?: number; donorName?: string };
                const qty = pledgeData.quantity ?? 1;
                const donor = pledgeData.donorName ?? 'Anonymous';
                const pledgeShelterId = pledgeData.shelterId ?? String(toolInput['shelterId'] ?? '');
                const pledgeItem = pledgeData.item ?? String(toolInput['item'] ?? 'items');
                await executeAlertTool({
                  shelterId: pledgeShelterId,
                  message: `🤝 ${donor} has pledged to donate ${qty}× ${pledgeItem}`,
                });
              } catch {
                // Non-fatal — pledge still succeeded
              }
            } else if (name === 'AlertTool') {
              result = await executeAlertTool(toolInput);
              toolUsed = 'alert';
            } else {
              result = JSON.stringify({ error: 'Unknown tool' });
            }
          } catch (toolErr) {
            result = JSON.stringify({ error: toolErr instanceof Error ? toolErr.message : 'Tool execution failed' });
          }

          toolResults.push({
            toolResult: {
              toolUseId: toolUseId ?? '',
              content: [{ text: result }],
            },
          });
        }

        // Feed tool results back
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      break;
    }

    if (!finalText) {
      finalText = "I'm having trouble connecting right now. Please browse the shelter list directly to find where your help is needed most.";
    }

    return new Response(
      JSON.stringify({ text: finalText, toolUsed }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : 'UnknownError';
    console.error('[advocate] Bedrock error:', errName, errMsg);
    const fallback = `I'm having trouble connecting right now (${errName}). Please browse the shelter list directly to find where your help is needed most.`;
    return new Response(JSON.stringify({ text: fallback, debug: errMsg }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
