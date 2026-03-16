'use client';

import { useState } from 'react';

export function AddShelterForm() {
  const [shelterId, setShelterId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/shelters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelterId, name, phone }),
      });

      if (res.ok) {
        setStatus('success');
        setShelterId('');
        setName('');
        setPhone('');
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg((data as { error?: string }).error ?? 'Failed to add shelter');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Failed to add shelter');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1 text-sm text-text">
        Shelter ID
        <input
          value={shelterId}
          onChange={(e) => setShelterId(e.target.value)}
          required
          className="border border-surface-border rounded px-3 py-1.5 text-text focus-visible:ring-2 focus-visible:ring-text outline-none"
          placeholder="shelter-005"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border border-surface-border rounded px-3 py-1.5 text-text focus-visible:ring-2 focus-visible:ring-text outline-none"
          placeholder="Shelter Name"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text">
        Phone (E.164)
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          type="tel"
          className="border border-surface-border rounded px-3 py-1.5 text-text focus-visible:ring-2 focus-visible:ring-text outline-none"
          placeholder="+12175550000"
        />
      </label>

      {status === 'error' && (
        <p role="alert" className="text-sm text-priority-critical">{errorMsg}</p>
      )}
      {status === 'success' && (
        <p role="status" className="text-sm text-green-700">Shelter added successfully.</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-4 py-2 bg-text text-white rounded font-medium hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-text"
      >
        {status === 'loading' ? 'Adding…' : 'Add Shelter'}
      </button>
    </form>
  );
}
