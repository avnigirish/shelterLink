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

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'text-green-600 dark:text-green-400',
  FULL: 'text-yellow-600 dark:text-yellow-400',
  CLOSED: 'text-red-600 dark:text-red-400',
};

export const revalidate = 60;

export default async function SupplyDrivePage() {
  const shelters = await getAllShelters();

  // Aggregate all unfulfilled needs across every shelter
  const needsMap = new Map<string, {
    priority: Priority;
    shelters: { id: string; name: string; status: string; state: string; itemPriority: Priority }[];
  }>();

  for (const shelter of shelters) {
    for (const need of shelter.needsList) {
      if (need.fulfilled) continue;
      const existing = needsMap.get(need.item);
      if (!existing) {
        needsMap.set(need.item, {
          priority: need.priority,
          shelters: [{ id: shelter.shelterId, name: shelter.name, status: shelter.status, state: shelter.state, itemPriority: need.priority }],
        });
      } else {
        if (PRIORITY_ORDER[need.priority] > PRIORITY_ORDER[existing.priority]) {
          existing.priority = need.priority;
        }
        existing.shelters.push({ id: shelter.shelterId, name: shelter.name, status: shelter.status, state: shelter.state, itemPriority: need.priority });
      }
    }
  }

  // Sort shelters within each item by priority desc, then status (OPEN first)
  for (const [, val] of needsMap) {
    val.shelters.sort((a, b) => {
      const pd = PRIORITY_ORDER[b.itemPriority] - PRIORITY_ORDER[a.itemPriority];
      if (pd !== 0) return pd;
      if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
      if (b.status === 'OPEN' && a.status !== 'OPEN') return 1;
      return 0;
    });
  }

  // Sort items by priority desc, then by number of shelters needing it desc
  const ranked = [...needsMap.entries()]
    .sort(([, a], [, b]) => {
      const pd = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      return pd !== 0 ? pd : b.shelters.length - a.shelters.length;
    })
    .slice(0, 15);

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
          The most urgently needed items across all {totalShelters} shelters — click any item to see which shelters need it and pledge directly.
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

      {ranked.length === 0 ? (
        <p className="text-text-subtle dark:text-dark-subtle text-sm">No active needs right now — check back soon.</p>
      ) : (
        <ol className="space-y-4">
          {ranked.map(([item, { priority, shelters: needingShelters }], idx) => (
            <li
              key={item}
              className="rounded-xl border border-surface-border dark:border-dark-border
                bg-surface-DEFAULT dark:bg-dark-surface overflow-hidden"
            >
              {/* Item header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40
                  text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-DEFAULT dark:text-dark-text capitalize">{item}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[priority]}`}>
                    {PRIORITY_LABEL[priority]}
                  </span>
                  <span className="text-xs text-text-subtle dark:text-dark-subtle">
                    {needingShelters.length} shelter{needingShelters.length !== 1 ? 's' : ''} in need
                  </span>
                </div>
              </div>

              {/* Shelter rows */}
              <div className="border-t border-surface-border dark:border-dark-border divide-y divide-surface-border dark:divide-dark-border">
                {needingShelters.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/shelter/${s.id}`}
                          className="text-sm font-medium text-text-DEFAULT dark:text-dark-text hover:text-brand-600
                            dark:hover:text-brand-400 hover:underline focus-visible:outline-none
                            focus-visible:ring-1 focus-visible:ring-brand-500 rounded truncate"
                        >
                          {s.name}
                        </Link>
                        <span className="text-xs text-text-subtle dark:text-dark-subtle">{s.state}</span>
                        <span className={`text-xs font-medium ${STATUS_BADGE[s.status] ?? ''}`}>
                          {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <span className={`text-xs ${PRIORITY_BADGE[s.itemPriority]} px-1.5 py-0.5 rounded-full mt-1 inline-block`}>
                        {PRIORITY_LABEL[s.itemPriority]} need
                      </span>
                    </div>
                    <Link
                      href={`/donate/${s.id}?item=${encodeURIComponent(item)}`}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600
                        text-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-500
                        focus:ring-offset-2 dark:focus:ring-offset-dark-surface transition-colors"
                    >
                      Pledge
                    </Link>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 text-xs text-text-faint dark:text-dark-subtle">
        Updated every minute. Priority shown is per shelter. Click a shelter name to see its full needs list and community chat.
      </p>
    </div>
  );
}
