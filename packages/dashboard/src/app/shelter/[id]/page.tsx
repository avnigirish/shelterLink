import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getShelterById } from '@/lib/db';
import { PRIORITY_ORDER } from '@/types/shelter';
import type { NeedsItem, Priority } from '@/types/shelter';

const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const PRIORITY_CLASSES: Record<Priority, string> = {
  CRITICAL: 'bg-red-100 text-priority-critical',
  HIGH: 'bg-red-50 text-priority-high',
  MEDIUM: 'bg-amber-50 text-priority-medium',
  LOW: 'bg-blue-50 text-priority-low',
};

function NeedsListItem({ need }: { need: NeedsItem }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 border-b border-surface-border last:border-0">
      <span className="text-text capitalize">{need.item}</span>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_CLASSES[need.priority]}`}
        aria-label={`Priority: ${PRIORITY_LABELS[need.priority]}`}
      >
        {PRIORITY_LABELS[need.priority]}
      </span>
    </li>
  );
}

export default async function ShelterDetailPage({ params }: { params: { id: string } }) {
  const shelter = await getShelterById(params.id);
  if (!shelter) return notFound();

  const activeNeeds = shelter.needsList
    .filter((n) => !n.fulfilled)
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);

  return (
    <div className="max-w-2xl">
      <Link href="/" className="text-sm text-text-subtle hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 rounded">
        ← Back to all shelters
      </Link>
      <h2 className="text-2xl font-bold text-text mt-4 mb-1">{shelter.name}</h2>
      <p className="text-text-subtle text-sm mb-1">{shelter.address}</p>
      <p className="text-text-subtle text-sm mb-6">{shelter.phone}</p>

      <section aria-label="Current needs">
        <h3 className="text-lg font-semibold text-text mb-3">Current Needs</h3>
        {activeNeeds.length === 0 ? (
          <p className="text-text-muted">No current needs.</p>
        ) : (
          <ul className="list-none p-0 divide-y divide-surface-border border border-surface-border rounded-lg overflow-hidden bg-white">
            {activeNeeds.map((need, i) => (
              <NeedsListItem key={`${need.item}-${i}`} need={need} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
