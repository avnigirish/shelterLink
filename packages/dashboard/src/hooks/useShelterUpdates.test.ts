import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShelterUpdates } from './useShelterUpdates';
import type { ShelterRecord } from '@/types/shelter';

// ---------------------------------------------------------------------------
// Minimal EventSource mock
// ---------------------------------------------------------------------------
type ESHandler = ((event: Event) => void) | null;

class MockEventSource {
  static instance: MockEventSource | null = null;

  url: string;
  onopen: ESHandler = null;
  onmessage: ESHandler = null;
  onerror: ESHandler = null;
  readyState = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    MockEventSource.instance = this;
  }

  /** Simulate the server accepting the connection */
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.(new Event('open'));
  }

  /** Simulate an incoming message */
  simulateMessage(data: unknown) {
    const event = Object.assign(new MessageEvent('message', { data: JSON.stringify(data) }));
    this.onmessage?.(event);
  }

  /** Simulate a connection error */
  simulateError() {
    this.readyState = 2; // CLOSED
    this.onerror?.(new Event('error'));
  }

  close() {
    this.readyState = 2;
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const shelter1: ShelterRecord = {
  shelterId: 's1',
  name: 'Shelter One',
  address: '1 Main St',
  phone: '+15550001111',
  beds: 10,
  capacity: 20,
  status: 'OPEN',
  needsList: [],
  lastUpdated: '2026-01-01T00:00:00Z',
};

const shelter2: ShelterRecord = {
  shelterId: 's2',
  name: 'Shelter Two',
  address: '2 Oak Ave',
  phone: '+15550002222',
  beds: 5,
  capacity: 10,
  status: 'OPEN',
  needsList: [],
  lastUpdated: '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource);
  vi.useFakeTimers();
  MockEventSource.instance = null;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useShelterUpdates', () => {
  it('starts in disconnected state with initial shelters', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1, shelter2]));
    expect(result.current.status).toBe('disconnected');
    expect(result.current.shelters).toHaveLength(2);
    expect(result.current.lastUpdated).toBeNull();
  });

  it('transitions to connected on EventSource open', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1]));
    act(() => MockEventSource.instance!.simulateOpen());
    expect(result.current.status).toBe('connected');
  });

  it('merges incoming shelter update into state', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1, shelter2]));
    act(() => MockEventSource.instance!.simulateOpen());

    const updated: ShelterRecord = { ...shelter1, beds: 3 };
    act(() => MockEventSource.instance!.simulateMessage(updated));

    expect(result.current.shelters.find((s) => s.shelterId === 's1')?.beds).toBe(3);
    expect(result.current.lastUpdated).not.toBeNull();
    expect(result.current.status).toBe('connected');
  });

  it('does not mutate unrelated shelters on update', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1, shelter2]));
    act(() => MockEventSource.instance!.simulateOpen());

    const updated: ShelterRecord = { ...shelter1, beds: 1 };
    act(() => MockEventSource.instance!.simulateMessage(updated));

    expect(result.current.shelters.find((s) => s.shelterId === 's2')?.beds).toBe(5);
  });

  it('transitions to disconnected on EventSource error', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1]));
    act(() => MockEventSource.instance!.simulateOpen());
    act(() => MockEventSource.instance!.simulateError());
    expect(result.current.status).toBe('disconnected');
  });

  it('transitions to stale after 30 s without a message', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1]));
    act(() => MockEventSource.instance!.simulateOpen());
    expect(result.current.status).toBe('connected');

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.status).toBe('stale');
  });

  it('resets stale timer on each incoming message', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1]));
    act(() => MockEventSource.instance!.simulateOpen());

    // Advance 20 s, then receive a message — timer should reset
    act(() => vi.advanceTimersByTime(20_000));
    act(() => MockEventSource.instance!.simulateMessage({ ...shelter1, beds: 2 }));

    // Another 20 s — still under 30 s since last message
    act(() => vi.advanceTimersByTime(20_000));
    expect(result.current.status).toBe('connected');

    // Now cross the 30 s threshold
    act(() => vi.advanceTimersByTime(10_001));
    expect(result.current.status).toBe('stale');
  });

  it('ignores malformed JSON messages without crashing', () => {
    const { result } = renderHook(() => useShelterUpdates([shelter1]));
    act(() => MockEventSource.instance!.simulateOpen());

    const badEvent = new MessageEvent('message', { data: 'not-json{{' });
    act(() => MockEventSource.instance!.onmessage?.(badEvent));

    // State should be unchanged
    expect(result.current.shelters).toHaveLength(1);
    expect(result.current.status).toBe('connected');
  });
});
