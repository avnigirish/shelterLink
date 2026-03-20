'use client';

import { useState } from 'react';
import type { NeedsItem, Priority } from '@/types/shelter';
import { PRIORITY_ORDER } from '@/types/shelter';

type FilterValue = Priority | 'ALL';

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'All',      value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High',     value: 'HIGH' },
  { label: 'Medium',   value: 'MEDIUM' },
  { label: 'Low',      value: 'LOW' },
];

const PRIORITY_CLASSES: Record<Priority, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  HIGH:     'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  MEDIUM:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  LOW:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH:     'High',
  MEDIUM:   'Medium',
  LOW:      'Low',
};

export function NeedsFilter({ needs }: { needs: NeedsItem[] }) {
  const [activeFilter, setActiveFilter] = useState<FilterValue>('ALL');

  const filtered = needs
    .filter((n) => activeFilter === 'ALL' || n.priority === activeFilter)
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter needs by priority">
        {FILTERS.map(({ label, value }) => {
          const isActive = activeFilter === value;
          return (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              aria-pressed={isActive}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500
                ${isActive
                  ? 'bg-text-DEFAULT dark:bg-dark-text text-white dark:text-dark-bg border-text-DEFAULT dark:border-dark-text'
                  : 'bg-surface-DEFAULT dark:bg-dark-elevated text-text-muted dark:text-dark-muted border-surface-border dark:border-dark-border hover:border-text-subtle dark:hover:border-dark-muted'
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Needs list */}
      {filtered.length === 0 ? (
        <p className="text-text-subtle dark:text-dark-subtle text-sm">No current needs.</p>
      ) : (
        <ul className="list-none p-0 divide-y divide-surface-border dark:divide-dark-border
          border border-surface-border dark:border-dark-border
          rounded-lg overflow-hidden
          bg-surface-DEFAULT dark:bg-dark-elevated">
          {filtered.map((need, i) => (
            <li
              key={`${need.item}-${i}`}
              className="flex items-center justify-between gap-2 px-4 py-2.5"
            >
              <span className="text-text-DEFAULT dark:text-dark-text capitalize">{need.item}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_CLASSES[need.priority]}`}
                aria-label={`Priority: ${PRIORITY_LABELS[need.priority]}`}
              >
                {PRIORITY_LABELS[need.priority]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
