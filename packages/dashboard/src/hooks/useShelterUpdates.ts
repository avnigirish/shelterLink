'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ShelterRecord } from '@/types/shelter';

export type ConnectionStatus = 'connected' | 'disconnected' | 'stale';

export interface UseShelterUpdatesResult {
  shelters: ShelterRecord[];
  status: ConnectionStatus;
  lastUpdated: Date | null;
}

const STALE_THRESHOLD_MS = 30_000;

export function useShelterUpdates(initialShelters: ShelterRecord[]): UseShelterUpdatesResult {
  const [shelters, setShelters] = useState<ShelterRecord[]>(initialShelters);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    staleTimerRef.current = setTimeout(() => {
      setStatus('stale');
    }, STALE_THRESHOLD_MS);
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/updates');
    esRef.current = es;

    es.onopen = () => {
      setStatus('connected');
      resetStaleTimer();
    };

    es.onmessage = (event) => {
      try {
        const updated = JSON.parse(event.data) as ShelterRecord;
        setShelters((prev) =>
          prev.map((s) => (s.shelterId === updated.shelterId ? updated : s))
        );
        setLastUpdated(new Date());
        setStatus('connected');
        resetStaleTimer();
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setStatus('disconnected');
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };

    return () => {
      es.close();
      esRef.current = null;
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };
  }, [resetStaleTimer]);

  return { shelters, status, lastUpdated };
}
