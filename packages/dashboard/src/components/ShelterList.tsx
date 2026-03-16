'use client';

import { useShelterUpdates } from '@/hooks/useShelterUpdates';
import type { ShelterRecord, ShelterStatus } from '@/types/shelter';

const STATUS_LABELS: Record<ShelterStatus, string> = {
  OPEN: 'Open',
  FULL: 'Full',
  CLOSED: 'Closed',
};

const STATUS_CLASSES: Record<ShelterStatus, string> = {
  OPEN: 'bg-green-100 text-status-open',
  FULL: 'bg-amber-100 text-status-full',
  CLOSED: 'bg-red-100 text-status-closed',
};

function ShelterCard({ shelter }: { shelter: ShelterRecord }) {
  const occupancyPct =
    shelter.capacity > 0
      ? Math.round((1 - shelter.beds / shelter.capacity) * 100)
      : 0;
  const updatedAt = new Date(shelter.updatedAt).toLocaleString();

  return (
    <article className="bg-white rounded-lg border border-surface-border p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-text">{shelter.name}</h2>
        <span
          className={`text-sm font-medium px-2 py-0.5 rounded ${STATUS_CLASSES[shelter.status]}`}
          aria-label={`Status: ${STATUS_LABELS[shelter.status]}`}
        >
          {STATUS_LABELS[shelter.status]}
        </span>
      </div>
      <p className="text-text-muted text-sm">
        <span className="font-medium">{shelter.beds}</span> of{' '}
        <span className="font-medium">{shelter.capacity}</span> beds available
        <span className="text-text-subtle ml-2">({occupancyPct}% occupied)</span>
      </p>
      <p className="text-text-subtle text-sm">{shelter.address}</p>
      <p className="text-text-subtle text-sm">{shelter.phone}</p>
      <p className="text-text-subtle text-xs mt-1">Updated: {updatedAt}</p>
    </article>
  );
}

export function ShelterList({ initialShelters }: { initialShelters: ShelterRecord[] }) {
  const { shelters, status, lastUpdated } = useShelterUpdates(initialShelters);
  const isStale = status === 'disconnected' || status === 'stale';

  return (
    <>
      <div role="status" aria-live="polite">
        {isStale && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <span className="font-medium">Live updates paused.</span>{' '}
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : 'Connecting to live updates...'}
          </div>
        )}
      </div>
      {shelters.length === 0 ? (
        <p className="text-text-muted">No shelters available.</p>
      ) : (
        <div aria-live="polite" aria-atomic="false">
          <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            {shelters.map((shelter) => (
              <li key={shelter.shelterId}>
                <ShelterCard shelter={shelter} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
