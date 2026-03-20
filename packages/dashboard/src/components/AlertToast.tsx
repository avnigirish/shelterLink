'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from '@/types/shelter';

interface AlertEvent extends ChatMessage {
  shelterName: string;
}

interface Toast {
  id: string;
  alert: AlertEvent;
}

export function AlertToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/alerts');

    es.onmessage = (e: MessageEvent) => {
      try {
        const alert = JSON.parse(e.data as string) as AlertEvent;
        const id = `${alert.roomId}-${alert.timestamp}`;
        setToasts((prev) => [...prev.slice(-4), { id, alert }]);
        // Auto-dismiss after 5s
        setTimeout(() => dismiss(id), 5_000);
      } catch {
        // ignore malformed events
      }
    };

    return () => es.close();
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Alert notifications"
      className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      {toasts.map(({ id, alert }) => (
        <div
          key={id}
          role="status"
          className="group relative flex items-start gap-3 rounded-lg shadow-lg border cursor-pointer
            bg-teal-50 dark:bg-teal-900/80 border-teal-200 dark:border-teal-700
            px-4 py-3 animate-slide-in
            hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
          onClick={() => {
            dismiss(id);
            router.push(`/shelter/${alert.roomId}`);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              dismiss(id);
              router.push(`/shelter/${alert.roomId}`);
            }
          }}
          tabIndex={0}
          aria-label={`Alert from ${alert.shelterName} — click to view shelter`}
        >
          <span className="text-lg leading-none mt-0.5 shrink-0" aria-hidden="true">📣</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 truncate">
              {alert.shelterName}
            </p>
            <p className="text-sm text-teal-900 dark:text-teal-100 mt-0.5 leading-snug">
              {alert.message}
            </p>
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 group-hover:underline">
              View shelter →
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss(id);
            }}
            aria-label="Dismiss notification"
            className="text-teal-500 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-200
              focus:outline-none focus:ring-2 focus:ring-teal-500 rounded shrink-0 mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
