'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NeedsItem } from '@/types/shelter';

interface Props {
  inventory: Record<string, number>;
  needsList: NeedsItem[];
  shelterId: string;
  isAdmin: boolean;
}

export function InventoryPanel({ inventory, needsList, shelterId, isAdmin }: Props) {
  const entries = Object.entries(inventory);
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(entries)
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Build a lookup: item name → need priority (for items that are in needsList)
  const needsPriority: Record<string, NeedsItem['priority']> = {};
  for (const n of needsList) {
    needsPriority[n.item.toLowerCase()] = n.priority;
  }

  if (entries.length === 0) {
    return (
      <section aria-label="Inventory" className="mt-6">
        <h3 className="text-lg font-semibold text-text-DEFAULT dark:text-dark-text mb-3">Inventory</h3>
        <p className="text-text-subtle dark:text-dark-subtle text-sm">No inventory listed</p>
      </section>
    );
  }

  async function handleSave(item: string) {
    setSaving(item);
    setSaved(null);
    try {
      const res = await fetch(`/api/admin/shelters/${shelterId}/inventory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, quantity: quantities[item] ?? 0 }),
      });
      if (res.ok) {
        setSaved(item);
        setTimeout(() => {
          setSaved(null);
          // Refresh SSR data so NeedsFilter reflects inventory changes
          router.refresh();
        }, 800);
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <section aria-label="Inventory" className="mt-6">
      <h3 className="text-lg font-semibold text-text-DEFAULT dark:text-dark-text mb-3">Inventory</h3>
      <table className="w-full text-sm border border-surface-border dark:border-dark-border rounded-lg overflow-hidden">
        <thead className="bg-surface-muted dark:bg-dark-elevated">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Item</th>
            <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Quantity</th>
            {isAdmin && <th className="px-4 py-2" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border dark:divide-dark-border bg-surface-DEFAULT dark:bg-dark-surface">
          {entries.map(([item]) => {
            const qty = quantities[item] ?? 0;
            const priority = needsPriority[item.toLowerCase()];
            const isOutAndNeeded = qty === 0 && (priority === 'CRITICAL' || priority === 'HIGH');

            return (
              <tr key={item} className={isOutAndNeeded ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                <td className="px-4 py-2 text-text-DEFAULT dark:text-dark-text capitalize">
                  {item}
                  {isOutAndNeeded && (
                    <span className="ml-2 text-xs font-medium text-red-600 dark:text-red-400">
                      ↑ {priority === 'CRITICAL' ? 'Critical need' : 'High need'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {isAdmin ? (
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="w-24 border border-surface-border dark:border-dark-border rounded px-2 py-1 text-sm
                        bg-surface-DEFAULT dark:bg-dark-elevated
                        text-text-DEFAULT dark:text-dark-text
                        focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label={`Quantity for ${item}`}
                    />
                  ) : qty === 0 ? (
                    <span className="inline-block text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
                      Out of stock
                    </span>
                  ) : (
                    <span className="text-text-DEFAULT dark:text-dark-text">{qty}</span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleSave(item)}
                      disabled={saving === item}
                      className="text-xs px-2 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded
                        disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label={`Save quantity for ${item}`}
                    >
                      {saving === item ? 'Saving…' : saved === item ? 'Saved ✓' : 'Save'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
