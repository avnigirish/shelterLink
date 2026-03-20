'use client';

import { useState } from 'react';

interface Props {
  donationId: string;
  userId: string;
  currentStatus: string;
  onDelivered?: () => void;
}

export function MarkDeliveredButton({ donationId, userId, currentStatus, onDelivered }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(currentStatus === 'DELIVERED');

  if (done) {
    return (
      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
        Delivered
      </span>
    );
  }

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/donations/${donationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setDone(true);
        onDelivered?.();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={`Mark donation ${donationId} as delivered`}
    >
      {loading ? 'Saving…' : 'Mark Delivered'}
    </button>
  );
}
