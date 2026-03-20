/**
 * Singleton in-memory chat store for mock mode.
 *
 * Attaches to `globalThis` so Next.js dev-mode hot-reloads and separate
 * route-handler module instances all share the exact same array reference.
 * Without this, each route gets its own copy of the seeded array and writes
 * from one handler are invisible to reads in another.
 */
import type { ChatMessage } from '@/types/shelter';

declare global {
  // eslint-disable-next-line no-var
  var __mockChatStore: ChatMessage[] | undefined;
}

function seed(): ChatMessage[] {
  return [
    // shelter-001 — Helping Hands of Springfield
    {
      roomId: 'shelter-001',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 Alice Johnson has pledged to donate 10× blankets',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-001',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      senderName: 'Jane V.',
      message: 'Bringing blankets tomorrow morning — see you at 9am!',
      userType: 'VOLUNTEER',
    },
    {
      roomId: 'shelter-001',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 Grace Nguyen has pledged to donate 12× children\'s clothing',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-001',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      senderName: 'Mark D.',
      message: 'I can also bring canned goods this weekend if needed.',
      userType: 'DONOR',
    },

    // shelter-002 — Contact Ministries
    {
      roomId: 'shelter-002',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 Bob Martinez has pledged to donate 50× diapers',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-002',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      senderName: 'Staff',
      message: 'We are critically low on baby formula — any help appreciated.',
      userType: 'STAFF',
    },
    {
      roomId: 'shelter-002',
      timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      senderName: 'Bob M.',
      message: 'Dropping off diapers and formula tomorrow at noon.',
      userType: 'DONOR',
    },

    // shelter-003 — Salvation Army Springfield
    {
      roomId: 'shelter-003',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 Carol Lee has pledged to donate 20× hygiene kits',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-003',
      timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      senderName: 'Carol L.',
      message: 'Delivered! Staff was incredibly welcoming.',
      userType: 'VOLUNTEER',
    },

    // shelter-101 — Covenant House New Jersey
    {
      roomId: 'shelter-101',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 Henry Patel has pledged to donate 10× hygiene kits',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-101',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      senderName: 'Sarah M.',
      message: 'We have extra teen clothing sizes M and L if anyone can pick up.',
      userType: 'STAFF',
    },
    {
      roomId: 'shelter-101',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 David Kim has pledged to donate 8× winter coats',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-101',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      senderName: 'Priya R.',
      message: 'On my way with the hygiene kits now!',
      userType: 'VOLUNTEER',
    },

    // shelter-201 — Bowery Mission
    {
      roomId: 'shelter-201',
      timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 Elena Vasquez has pledged to donate 5× blankets',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-201',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      senderName: 'Tom B.',
      message: 'Dropped off 30 pairs of socks this afternoon. Staff was great.',
      userType: 'VOLUNTEER',
    },
    {
      roomId: 'shelter-201',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      senderName: 'Staff',
      message: 'Winter coats are critically needed — we have 30 beds open tonight.',
      userType: 'STAFF',
    },

    // shelter-501 — Central Union Mission
    {
      roomId: 'shelter-501',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      senderName: 'Community Advocate',
      message: '🤝 Frank Okafor has pledged to donate 48× canned food',
      userType: 'ADMIN',
    },
    {
      roomId: 'shelter-501',
      timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      senderName: 'Lisa C.',
      message: 'Is the loading dock open on Saturdays? Want to bring a car full.',
      userType: 'DONOR',
    },
    {
      roomId: 'shelter-501',
      timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      senderName: 'Admin',
      message: 'Yes — dock is open Sat 8am–2pm. Ask for Marcus at the front.',
      userType: 'STAFF',
    },
  ];
}

// Attach to globalThis so hot-reloads don't wipe the array
if (!globalThis.__mockChatStore) {
  globalThis.__mockChatStore = seed();
}

const store = globalThis.__mockChatStore;

export function getMessages(roomId: string): ChatMessage[] {
  return store.filter((m) => m.roomId === roomId);
}

export function getAllMessages(): ChatMessage[] {
  return store;
}

export function addMessage(msg: ChatMessage): void {
  store.push(msg);
}
