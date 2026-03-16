'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  shelterId: string;
  name: string;
}

export function RemoveShelterButton({ shelterId, name }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRemove() {
    if (!confirm(`Remove "${name}" from the registry?`)) return;
    setLoading(true);

    const res = await fetch(`/api/admin/shelters/${shelterId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      // hashedPhone would come from the server in a real flow;
      // for now we pass shelterId as a placeholder identifier
      body: JSON.stringify({ hashedPhone: shelterId }),
    });

    setLoading(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      aria-label={`Remove ${name}`}
      className="text-sm text-priority-critical hover:underline disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-priority-critical rounded"
    >
      {loading ? 'Removing…' : 'Remove'}
    </button>
  );
}
