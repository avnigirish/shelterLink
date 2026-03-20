import type { ChatMessage } from '@/types/shelter';

// Shared in-memory mock store for chat messages — seeded with realistic activity per shelter.
// Imported by both chat/[shelterId]/route.ts (read/write) and advocate/route.ts (write on pledge).
export const MOCK_MESSAGES: ChatMessage[] = [
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
  // shelter-007 — Covenant House New Jersey
  {
    roomId: 'shelter-007',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    senderName: 'Community Advocate',
    message: '🤝 Henry Patel has pledged to donate 10× hygiene kits',
    userType: 'ADMIN',
  },
  {
    roomId: 'shelter-007',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    senderName: 'Sarah M.',
    message: 'We have extra teen clothing sizes M and L if anyone can pick up.',
    userType: 'STAFF',
  },
  {
    roomId: 'shelter-007',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    senderName: 'Community Advocate',
    message: '🤝 David Kim has pledged to donate 8× winter coats',
    userType: 'ADMIN',
  },
  {
    roomId: 'shelter-007',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    senderName: 'Priya R.',
    message: 'On my way with the hygiene kits now!',
    userType: 'VOLUNTEER',
  },
  // shelter-010 — Bowery Mission
  {
    roomId: 'shelter-010',
    timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    senderName: 'Community Advocate',
    message: '🤝 Elena Vasquez has pledged to donate 5× blankets',
    userType: 'ADMIN',
  },
  {
    roomId: 'shelter-010',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    senderName: 'Tom B.',
    message: 'Dropped off 30 pairs of socks this afternoon. Staff was great.',
    userType: 'VOLUNTEER',
  },
  // shelter-015 — Central Union Mission
  {
    roomId: 'shelter-015',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    senderName: 'Community Advocate',
    message: '🤝 Frank Okafor has pledged to donate 48× canned food',
    userType: 'ADMIN',
  },
  {
    roomId: 'shelter-015',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    senderName: 'Lisa C.',
    message: 'Is the loading dock open on Saturdays? Want to bring a car full.',
    userType: 'DONOR',
  },
  {
    roomId: 'shelter-015',
    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    senderName: 'Admin',
    message: 'Yes — dock is open Sat 8am–2pm. Ask for Marcus at the front.',
    userType: 'STAFF',
  },
];
