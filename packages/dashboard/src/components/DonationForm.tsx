'use client';

import { useState } from 'react';
import type { DonationItem } from '@/types/shelter';

interface Props {
  shelterId: string;
  shelterName: string;
}

interface FormItem {
  item: string;
  quantity: number;
}

export function DonationForm({ shelterId, shelterName }: Props) {
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [items, setItems] = useState<FormItem[]>([{ item: '', quantity: 1 }]);
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
        className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center"
      >
        <p className="text-lg font-semibold text-green-800 mb-2">Thank you for your pledge!</p>
        <p className="text-sm text-green-700">
          Your donation to <strong>{shelterName}</strong> has been recorded.
        </p>
        <p className="text-xs text-green-600 mt-3 font-mono">Pledge ID: {pledgeId}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Donation pledge form" noValidate>
      <div>
        <label htmlFor="donorName" className="block text-sm font-medium text-text mb-1">
          Your name
        </label>
        <input
          id="donorName"
          type="text"
          value={donorName}
          onChange={(e) => setDonorName(e.target.value)}
          placeholder="Jane Smith"
          className="w-full border border-surface-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="donorEmail" className="block text-sm font-medium text-text mb-1">
          Email address <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="donorEmail"
          type="email"
          value={donorEmail}
          onChange={(e) => setDonorEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full border border-surface-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-text mb-2">
          Items to donate <span className="text-red-500" aria-hidden="true">*</span>
        </legend>
        <div className="space-y-2">
          {items.map((it, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={it.item}
                onChange={(e) => updateItem(index, 'item', e.target.value)}
                placeholder="Item name (e.g. blankets)"
                className="flex-1 border border-surface-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Item ${index + 1} name`}
              />
              <input
                type="number"
                min={1}
                value={it.quantity}
                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                className="w-20 border border-surface-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Item ${index + 1} quantity`}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-sm text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
                  aria-label={`Remove item ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          + Add another item
        </button>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
      >
        {submitting ? 'Submitting…' : 'Submit Pledge'}
      </button>
    </form>
  );
}
