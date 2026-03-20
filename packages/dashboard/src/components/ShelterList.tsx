'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useShelterUpdates } from '@/hooks/useShelterUpdates';
import type { ShelterRecord, ShelterStatus } from '@/types/shelter';

const STATUS_LABELS: Record<ShelterStatus, string> = {
  OPEN: 'Open',
  FULL: 'Full',
  CLOSED: 'Closed',
};

const STATUS_EMOJI: Record<ShelterStatus, string> = {
  OPEN: '🟢',
  FULL: '🟡',
  CLOSED: '🔴',
};

const STATUS_CLASSES: Record<ShelterStatus, string> = {
  OPEN:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  FULL:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  CLOSED: 'bg-red-100  text-red-800  dark:bg-red-900/30  dark:text-red-300',
};

const BAR_CLASSES: Record<ShelterStatus, string> = {
  OPEN:   'bg-green-500 dark:bg-green-400',
  FULL:   'bg-amber-500 dark:bg-amber-400',
  CLOSED: 'bg-red-500   dark:bg-red-400',
};

function pill(active: boolean) {
  return active
    ? 'px-3 py-1 rounded-full text-xs font-semibold bg-brand-500 text-white shadow-sm'
    : 'px-3 py-1 rounded-full text-xs font-semibold bg-surface-subtle dark:bg-dark-elevated text-text-subtle dark:text-dark-muted hover:bg-surface-border dark:hover:bg-dark-border transition-colors';
}

function ShelterCard({ shelter }: { shelter: ShelterRecord }) {
  const occupancyPct =
    shelter.capacity > 0
      ? Math.round((1 - shelter.beds / shelter.capacity) * 100)
      : 0;
  const updatedAt = new Date(shelter.updatedAt).toLocaleString();
  const criticalNeeds = shelter.needsList.filter(
    (n) => !n.fulfilled && n.priority === 'CRITICAL'
  );

  return (
    <Link
      href={`/shelter/${shelter.shelterId}`}
      className="group block card-surface rounded-2xl
        border border-surface-border dark:border-dark-border
        bg-surface-DEFAULT/80 dark:bg-dark-elevated
        backdrop-blur-sm p-5 flex flex-col gap-3
        shadow-card dark:shadow-card-dark
        hover:shadow-card-hover dark:hover:shadow-card-dark-hover
        hover:border-brand-300 dark:hover:border-brand-600
        hover:-translate-y-0.5
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      aria-label={`${shelter.name} — ${STATUS_LABELS[shelter.status]}, ${shelter.beds} of ${shelter.capacity} beds available`}
    >
      <article className="flex flex-col gap-3">
        {/* Name + status badge */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-text-DEFAULT dark:text-dark-text leading-snug
            group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {shelter.name}
          </h2>
          <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLASSES[shelter.status]}`}>
            <span aria-hidden="true">{STATUS_EMOJI[shelter.status]}</span>
            {STATUS_LABELS[shelter.status]}
          </span>
        </div>

        {/* State tag */}
        <p className="text-xs text-text-faint dark:text-dark-subtle font-medium">{shelter.state}</p>

        {/* Bed count */}
        <p className="text-sm text-text-muted dark:text-dark-muted">
          <span className="text-xl font-bold text-text-DEFAULT dark:text-dark-text">{shelter.beds}</span>
          <span className="text-text-subtle dark:text-dark-subtle"> / {shelter.capacity} beds available</span>
          <span className="ml-2 text-xs text-text-faint dark:text-dark-subtle">({occupancyPct}% occupied)</span>
        </p>

        {/* Capacity bar */}
        <div
          role="meter"
          aria-label={`Occupancy: ${occupancyPct}%`}
          aria-valuenow={occupancyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-2 bg-surface-subtle dark:bg-dark-border rounded-full overflow-hidden"
        >
          <div
            className={`h-full rounded-full bar-animate ${BAR_CLASSES[shelter.status]}`}
            style={{ width: `${Math.min(occupancyPct, 100)}%` }}
          />
        </div>

        {/* Critical needs callout */}
        {criticalNeeds.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs
            text-red-700 dark:text-red-400
            bg-red-50 dark:bg-red-900/20
            border border-red-100 dark:border-red-900/40
            rounded-lg px-3 py-1.5">
            <span aria-hidden="true">🚨</span>
            <span className="font-medium">Critical:</span>
            <span>{criticalNeeds.map((n) => n.item).join(', ')}</span>
          </div>
        )}

        {/* Address + phone */}
        <div className="text-xs text-text-subtle dark:text-dark-subtle space-y-0.5">
          <p>{shelter.address}</p>
          <p>{shelter.phone}</p>
        </div>

        {/* Updated timestamp */}
        <p className="text-xs text-text-faint dark:text-dark-subtle/60">
          <time dateTime={shelter.updatedAt}>Updated {updatedAt}</time>
        </p>
      </article>
    </Link>
  );
}

export function ShelterList({ initialShelters }: { initialShelters: ShelterRecord[] }) {
  const { shelters, status, lastUpdated } = useShelterUpdates(initialShelters);
  const isStale = status === 'disconnected' || status === 'stale';

  // Filter state
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [needsSearch, setNeedsSearch] = useState('');

  // Derive available states from data
  const availableStates = useMemo(() => {
    const states = Array.from(new Set(shelters.map((s) => s.state))).sort();
    return ['All', ...states];
  }, [shelters]);

  // Apply filters
  const filtered = useMemo(() => {
    return shelters.filter((s) => {
      if (stateFilter !== 'All' && s.state !== stateFilter) return false;
      if (statusFilter !== 'All' && s.status !== statusFilter) return false;
      if (criticalOnly && !s.needsList.some((n) => !n.fulfilled && n.priority === 'CRITICAL')) return false;
      if (needsSearch.trim()) {
        const q = needsSearch.trim().toLowerCase();
        if (!s.needsList.some((n) => n.item.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [shelters, stateFilter, statusFilter, criticalOnly, needsSearch]);

  const openCount = filtered.filter((s) => s.status === 'OPEN').length;

  return (
    <>
      {/* Filter bar */}
      <div className="mb-6 space-y-3">
        {/* State pills */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by state">
          {availableStates.map((s) => (
            <button key={s} onClick={() => setStateFilter(s)} className={pill(stateFilter === s)}>
              {s}
            </button>
          ))}
        </div>

        {/* Status pills + critical toggle + search */}
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'OPEN', 'FULL', 'CLOSED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={pill(statusFilter === s)}
            >
              {s === 'All' ? 'All statuses' : STATUS_LABELS[s]}
            </button>
          ))}

          <button
            onClick={() => setCriticalOnly((v) => !v)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              criticalOnly
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-surface-subtle dark:bg-dark-elevated text-text-subtle dark:text-dark-muted hover:bg-surface-border dark:hover:bg-dark-border'
            }`}
            aria-pressed={criticalOnly}
          >
            🚨 Critical needs only
          </button>

          <input
            type="search"
            placeholder="Search needs…"
            value={needsSearch}
            onChange={(e) => setNeedsSearch(e.target.value)}
            className="ml-auto px-3 py-1 text-xs rounded-full
              border border-surface-border dark:border-dark-border
              bg-surface-DEFAULT dark:bg-dark-elevated
              text-text-DEFAULT dark:text-dark-text
              placeholder:text-text-faint dark:placeholder:text-dark-subtle
              focus:outline-none focus:ring-2 focus:ring-brand-500
              w-36 sm:w-48"
            aria-label="Search by need item"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <p className="text-sm text-text-subtle dark:text-dark-muted">
          <span className="font-semibold text-text-DEFAULT dark:text-dark-text">{filtered.length}</span>
          {filtered.length !== shelters.length && (
            <span className="text-text-faint dark:text-dark-subtle"> of {shelters.length}</span>
          )}{' '}
          shelters ·{' '}
          <span className="font-semibold text-green-700 dark:text-green-400">{openCount} open</span>
        </p>
        <div className="flex items-center gap-1.5 text-xs text-text-faint dark:text-dark-subtle">
          <span
            className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400 status-pulse' : 'bg-surface-border dark:bg-dark-border'}`}
            aria-hidden="true"
          />
          {status === 'connected' ? 'Live' : 'Connecting…'}
        </div>
      </div>

      {/* Stale-data banner */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {isStale && (
          <div className="mb-5 px-4 py-3 rounded-xl
            bg-amber-50 dark:bg-amber-900/20
            border border-amber-200 dark:border-amber-800
            text-amber-800 dark:text-amber-300 text-sm">
            <span className="font-semibold">Live updates paused.</span>{' '}
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : 'Connecting to live updates…'}
          </div>
        )}
      </div>

      {/* Shelter grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-faint dark:text-dark-subtle">
          <p className="text-4xl mb-3" aria-hidden="true">🔍</p>
          <p className="text-base">No shelters match your filters.</p>
          <button
            onClick={() => { setStateFilter('All'); setStatusFilter('All'); setCriticalOnly(false); setNeedsSearch(''); }}
            className="mt-3 text-sm text-brand-500 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div role="region" aria-label="Shelter cards" aria-live="polite" aria-atomic="false">
          <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            {filtered.map((shelter) => (
              <li key={shelter.shelterId} className="card-enter">
                <ShelterCard shelter={shelter} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
