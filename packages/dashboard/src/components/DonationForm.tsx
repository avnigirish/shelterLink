'use client';

import { useState } from 'react';
import type { DonationItem, NeedsItem, Priority } from '@/types/shelter';

const PRIORITY_BADGE: Record<Priority, string> = {
  CRITICAL: 'text-red-600 dark:text-red-400',
  HIGH: 'text-orange-600 dark:text-orange-400',
  MEDIUM: 'text-yellow-600 dark:text-yellow-400',
  LOW: 'text-gray-500 dark:text-gray-400',
};

interface Props {
  shelterId: string;
  shelterName: string;
  suggestedNeeds?: NeedsItem[];
  preselectedItem?: string;
}

interface FormItem {
  item: string;
  quantity: number;
}

export function DonationForm({ shelterId, shelterName, suggestedNeeds = [], preselectedItem = '' }: Props) {
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [items, setItems] = useState<FormItem[]>([{ item: preselectedItem, quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [pledgeId, setPledgeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [...prev, { item: '', quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof FormItem, value: string | number) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, [field]: value } : it
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validItems: DonationItem[] = items
      .filter((it) => it.item.trim())
      .map((it) => ({ item: it.item.trim(), quantity: Math.max(1, it.quantity) }));

    if (validItems.length === 0) {
      setError('No items added — please add at least one item to donate.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shelterId,
          shelterName,
          donorName: donorName.trim(),
          donorEmail: donorEmail.trim(),
          items: validItems,
        }),
      });

      const data = await res.json() as { ok: boolean; donationId?: string; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed to submit pledge. Please try again.');
        return;
      }

      setPledgeId(data.donationId ?? 'unknown');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (pledgeId) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-green-200 dark:border-green-800
          bg-green-50 dark:bg-green-900/20 px-6 py-8 text-center"
      >
        <p className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">Thank you for your pledge!</p>
        <p className="text-sm text-green-700 dark:text-green-400">
          Your donation to <strong>{shelterName}</strong> has been recorded.
        </p>
        <p className="text-xs text-green-600 dark:text-green-500 mt-3 font-mono">Pledge ID: {pledgeId}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Donation pledge form" noValidate>
      <div>
        <label htmlFor="donorName" className="block text-sm font-medium text-text-DEFAULT dark:text-dark-text mb-1">
          Your name
        </label>
        <input
          id="donorName"
          type="text"
          value={donorName}
          onChange={(e) => setDonorName(e.target.value)}
          placeholder="Jane Smith"
          className="w-full border border-surface-border dark:border-dark-border rounded px-3 py-2 text-sm
            bg-surface-DEFAULT dark:bg-dark-elevated text-text-DEFAULT dark:text-dark-text
            placeholder:text-text-faint dark:placeholder:text-dark-subtle
            focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <label htmlFor="donorEmail" className="block text-sm font-medium text-text-DEFAULT dark:text-dark-text mb-1">
          Email address <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="donorEmail"
          type="email"
          value={donorEmail}
          onChange={(e) => setDonorEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full border border-surface-border dark:border-dark-border rounded px-3 py-2 text-sm
            bg-surface-DEFAULT dark:bg-dark-elevated text-text-DEFAULT dark:text-dark-text
            placeholder:text-text-faint dark:placeholder:text-dark-subtle
            focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-text-DEFAULT dark:text-dark-text mb-2">
          Items to donate <span className="text-red-500" aria-hidden="true">*</span>
        </legend>
        <div className="space-y-2">
          {items.map((it, index) => (
            <div key={index} className="flex gap-2 items-center">
              {suggestedNeeds.length > 0 ? (
                <select
                  value={it.item}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateItem(index, 'item', val === '__custom__' ? '' : val);
                  }}
                  className="flex-1 border border-surface-border dark:border-dark-border rounded px-3 py-2 text-sm
                    bg-surface-DEFAULT dark:bg-dark-elevated text-text-DEFAULT dark:text-dark-text
                    focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label={`Item ${index + 1} name`}
                >
                  <option value="">Select an item\u2026</option>
                  <optgroup label="Current needs">
                    {suggestedNeeds.map((n) => (
                      <option key={n.item} value={n.item}>
                        {n.item} \u2014 {n.priority.charAt(0) + n.priority.slice(1).toLowerCase()} priority
                      </option>
                    ))}
                  </optgroup>
                  <option value="__custom__">Other (type below)</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={it.item}
                  onChange={(e) => updateItem(index, 'item', e.target.value)}
                  placeholder="Item name (e.g. blankets)"
                  className="flex-1 border border-surface-border dark:border-dark-border rounded px-3 py-2 text-sm
                    bg-surface-DEFAULT dark:bg-dark-elevated text-text-DEFAULT dark:text-dark-text
                    placeholder:text-text-faint dark:placeholder:text-dark-subtle
                    focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label={`Item ${index + 1} name`}
                />
              )}
              {suggestedNeeds.length > 0 && it.item === '' && (
                <input
                  type="text"
                  placeholder="Describe item"
                  onChange={(e) => updateItem(index, 'item', e.target.value)}
                  className="flex-1 border border-surface-border dark:border-dark-border rounded px-3 py-2 text-sm
                    bg-surface-DEFAULT dark:bg-dark-elevated text-text-DEFAULT dark:text-dark-text
                    placeholder:text-text-faint dark:placeholder:text-dark-subtle
                    focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label={`Item ${index + 1} custom name`}
                />
              )}
              <input
                type="number"
                min={1}
                value={it.quantity}
                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                className="w-20 border border-surface-border dark:border-dark-border rounded px-3 py-2 text-sm
                  bg-surface-DEFAULT dark:bg-dark-elevated text-text-DEFAULT dark:text-dark-text
                  focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label={`Item ${index + 1} quantity`}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300
                    focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
                  aria-label={`Remove item ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {suggestedNeeds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Priority[])
              .filter((p) => suggestedNeeds.some((n) => n.priority === p))
              .map((p) => (
                <span key={p} className={PRIORITY_BADGE[p]}>
                  \u25cf {p.charAt(0) + p.slice(1).toLowerCase()} priority
                </span>
              ))}
          </div>
        )}

        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300
            focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
        >
          + Add another item
        </button>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded
          disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1
          dark:focus:ring-offset-dark-surface"
      >
        {submitting ? 'Submitting\u2026' : 'Submit Pledge'}
      </button>
    </form>
  );
}
