/**
 * Singleton in-memory shelter store for mock mode.
 *
 * Attaches to `globalThis` so Next.js dev-mode hot-reloads and separate
 * route-handler module instances all share the exact same array reference.
 * This means inventory PATCH mutations are visible on the next SSR render.
 */
import type { ShelterRecord } from '@/types/shelter';
import { MOCK_SHELTERS } from './mockData';

declare global {
  // eslint-disable-next-line no-var
  var __mockShelterStore: ShelterRecord[] | undefined;
}

if (!globalThis.__mockShelterStore) {
  // Deep-copy so hot-reloads don't re-seed over live mutations
  globalThis.__mockShelterStore = JSON.parse(JSON.stringify(MOCK_SHELTERS)) as ShelterRecord[];
}

const store = globalThis.__mockShelterStore;

export function getMockShelters(): ShelterRecord[] {
  return store;
}

export function getMockShelterById(id: string): ShelterRecord | undefined {
  return store.find((s) => s.shelterId === id);
}
