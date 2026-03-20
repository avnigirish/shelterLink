import Link from 'next/link';
import { getAllShelters } from '@/lib/db';
import { PRIORITY_ORDER } from '@/types/shelter';
import type { Priority } from '@/types/shelter';

const PRIORITY_LABEL: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export const revalidate = 60; // ISR — refresh every 60 s

export default async function SupplyDrivePage() {
  const shelters = await getAllShelters();

  // Aggregate all unfulfilled needs across every shelter
  const needsMap = new Map<string, { priority: Priority; shelters: { id: string; name: string }[] }>();

  for (const shelter of shelters) {
    for (const need of shelter.needsList) {
      if (need.fulfilled) continue;
      const existing = needsMap.get(need.item);
      if (!existing) {
        needsMap.set(need.item, {
          priority: need.priority,
          shelters: [{ id: shelter.shelterId, name: shelter.name }],
        });
      } else {
        // Escalate priority if a higher-priority shelter needs the same item
        if (PRIORITY_ORDER[need.priority] > PRIORITY_ORDER[existing.priority]) {
          existing.priority = need.priority;
        }
        existing.shelters.push({ id: shelter.shelterId, name: shelter.name });
      }
    }
  }

  // Sort by priority desc, then by number of shelters needing it desc
  const ranked = [...needsMap.entries()]
    .sort(([, a], [, b]) => {
      const pd = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      return pd !== 0 ? pd : b.shelters.length - a.shelters.length;
    })
    .slice(0, 12);

  const totalShelters = shelters.length;
  const openShelters = shelters.filter((s) => s.status === 'OPEN').length;
  const criticalItems = ranked.filter(([, v]) => v.priority === 'CRITICAL').length;

  return (
    <div className="max-w-3xl fade-up">
      <Link
        href="/"
        className="text-sm text-text-subtle dark:text-dark-subtle hover:text-brand-600 dark:hover:text-brand-400
          hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          focus-visible:ring-brand-500 rounded transition-colors"
      >
        ← Back to all shelters
      </Link>

      <div className="mt-4 mb-6">
        <h2 className="text-2xl font-bold text-text-DEFAULT dark:text-dark-text">Community Supply Drive</h2>
        <p className="text-text-subtle dark:text-dark-subtle text-sm mt-1">
          The most urgently needed items across all {totalShelters} shelters right now — updated every minute.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Shelters tracked', value: totalShelters },
          { label: 'Open now', value: openShelters },
          { label: 'Critical items', value: criticalItems },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-surface-border dark:border-dark-border
              bg-surface-DEFAULT dark:bg-dark-surface px-4 py-3 text-center"
          >
            <p className="text-2xl font-bold text-brand-500">{value}</p>
            <p className="text-xs text-text-subtle dark:text-dark-subtle mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Ranked needs list */}
      {ranked.length === 0 ? (
        <p className="text-text-subtle dark:text-dark-subtle text-sm">No active needs right now — check back soon.</p>
      ) : (
        <ol className="space-y-3">
          {ranked.map(([item, { priority, shelters: needingShelters }], idx) => (
            <li
              key={item}
              className="flex items-start gap-4 rounded-xl border border-surface-border dark:border-dark-border
                bg-surface-DEFAULT dark:bg-dark-surface px-5 py-4"
            >
              {/* Rank number */}
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40
                text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-DEFAULT dark:text-dark-text capitalize">{item}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[priority]}`}>
                    {PRIORITY_LABEL[priority]}
                  </span>
                  <span className="text-xs text-text-subtle dark:text-dark-subtle">
                    {needingShelters.length} shelter{needingShelters.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Shelter links */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {needingShelters.slice(0, 4).map((s) => (
                    <Link
                      key={s.id}
                      href={`/shelter/${s.id}`}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline
                        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 rounded"
                    >
                      {s.name}
                    </Link>
                  ))}
                  {needingShelters.length > 4 && (
                    <span className="text-xs text-text-faint dark:text-dark-subtle">
                      +{needingShelters.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* CTA */}
              <Link
                href={`/donate/${needingShelters[0].id}`}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600
                  text-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-500
                  focus:ring-offset-2 dark:focus:ring-offset-dark-surface transition-colors"
              >
                Pledge
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 text-xs text-text-faint dark:text-dark-subtle">
        Needs are aggregated from live shelter data. Priority shown is the highest across all shelters needing that item.
        Click a shelter name to see its full needs list and community chat.
      </p>
    </div>
  );
}
