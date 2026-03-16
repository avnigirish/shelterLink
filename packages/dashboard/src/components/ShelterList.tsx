'use client';

import Link from 'next/link';
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
    <Link
      href={`/shelter/${shelter.shelterId}`}
      className="block bg-white rounded-lg border border-surface-border p-4 flex flex-col gap-2
        hover:border-text-subtle transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-text"
      aria-label={`${shelter.name} — ${STATUS_LABELS[shelter.status]}, ${shelter.beds} of ${shelter.capacity} beds available`}
    >
      <article className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-text">{shelter.name}</h2>
          <span
            className={`text-sm font-medium px-2 py-0.5 rounded ${STATUS_CLASSES[shelter.status]}`}
            aria-hidden="true"
          >
            {STATUS_LABELS[shelter.status]}
          </span>
        </div>
        <p className="text-text-muted text-sm">
          <span className="font-medium">{shelter.beds}</span> of{' '}
          <span className="font-medium">{shelter.capacity}</span> beds available
          <span
            className="text-text-subtle ml-2"
            aria-label={`${occupancyPct} percent occupied`}
          >
            ({occupancyPct}% occupied)
          </span>
        </p>
        {/* Capacity bar */}
        <div
          role="meter"
          aria-label={`Occupancy: ${occupancyPct}%`}
          aria-valuenow={occupancyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden"
        >
          <div
            className={`h-full rounded-full ${
              occupancyPct >= 100 ? 'bg-status-closed' :
              occupancyPct >= 80  ? 'bg-status-full' :
                                    'bg-status-open'
            }`}
            style={{ width: `${Math.min(occupancyPct, 100)}%` }}
          />
        </div>
        <p className="text-text-subtle text-sm">{shelter.address}</p>
        <p className="text-text-subtle text-sm">{shelter.phone}</p>
        <p className="text-text-subtle text-xs mt-1">
          <time dateTime={shelter.updatedAt}>Updated: {updatedAt}</time>
        </p>
      </article>
    </Link>
  );
}

export function ShelterList({ initialShelters }: { initialShelters: ShelterRecord[] }) {
  const { shelters, status, lastUpdated } = useShelterUpdates(initialShelters);
  const isStale = status === 'disconnected' || status === 'stale';

  return (
    <>
      {/* Stale-data banner — role="status" so screen readers announce it politely */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {isStale && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <span className="font-medium">Live updates paused.</span>{' '}
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : 'Connecting to live updates...'}
          </div>
        )}
      </div>

      {/* Shelter list — aria-live so card updates are announced without full re-read */}
      {shelters.length === 0 ? (
        <p className="text-text-muted">No shelters available.</p>
      ) : (
        <div
          role="region"
          aria-label="Shelter cards"
          aria-live="polite"
          aria-atomic="false"
        >
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
