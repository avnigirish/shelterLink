'use client';

import { useState } from 'react';
import type { NeedsItem, Priority } from '@/types/shelter';
import { PRIORITY_ORDER } from '@/types/shelter';

type FilterValue = Priority | 'ALL';

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

const PRIORITY_CLASSES: Record<Priority, string> = {
  CRITICAL: 'bg-red-100 text-priority-critical',
  HIGH: 'bg-red-50 text-priority-high',
  MEDIUM: 'bg-amber-50 text-priority-medium',
  LOW: 'bg-blue-50 text-priority-low',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
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
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-text
                ${isActive
                  ? 'bg-text text-white border-text'
                  : 'bg-white text-text-muted border-surface-border hover:border-text-subtle'
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Needs list */}
      {filtered.length === 0 ? (
        <p className="text-text-muted">No current needs.</p>
      ) : (
        <ul className="list-none p-0 divide-y divide-surface-border border border-surface-border rounded-lg overflow-hidden bg-white">
          {filtered.map((need, i) => (
            <li
              key={`${need.item}-${i}`}
              className="flex items-center justify-between gap-2 px-4 py-2"
            >
              <span className="text-text capitalize">{need.item}</span>
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
