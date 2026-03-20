'use client';

import { useState } from 'react';

interface Props {
  shelterId: string;
  shelterName?: string;
}

/** Normalize a user-typed phone string to E.164 format (+1XXXXXXXXXX for US). */
function normalizePhone(raw: string): string {
  // Strip everything except digits and leading +
  const digits = raw.replace(/[^\d+]/g, '');
  // If already starts with +, keep as-is
  if (digits.startsWith('+')) return digits;
  // Prepend +1 for 10-digit US numbers
  if (digits.length === 10) return `+1${digits}`;
  // Prepend + for 11-digit numbers starting with 1
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

type FormState = 'idle' | 'loading' | 'subscribed' | 'unsubscribed' | 'error';

export function AlertSubscribeForm({ shelterId, shelterName }: Props) {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const normalized = normalizePhone(phone);
  const isValid = E164_REGEX.test(normalized);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setErrorMsg('Please enter a valid US phone number (e.g. 555-867-5309).');
      setState('error');
      return;
    }
    setState('loading');
    try {
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, shelterId, shelterName }),
      });
      if (res.ok) {
        setState('subscribed');
      } else {
        setErrorMsg('Could not subscribe. Please try again.');
        setState('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  }

  async function handleUnsubscribe() {
    if (!isValid) return;
    setState('loading');
    try {
      const res = await fetch('/api/alerts/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      if (res.ok) {
        setState('unsubscribed');
      } else {
        setErrorMsg('Could not unsubscribe. Please try again.');
        setState('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  }

  if (state === 'subscribed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-4 text-sm text-green-800 dark:text-green-300"
      >
        You&apos;re subscribed to SMS alerts for this shelter.{' '}
        <button
          type="button"
          onClick={() => { setState('idle'); setPhone(''); }}
          className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
        >
          Subscribe another number
        </button>
      </div>
    );
  }

  if (state === 'unsubscribed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 p-4 text-sm text-text-subtle dark:text-dark-subtle"
      >
        You&apos;ve been unsubscribed from all ShelterLink alerts.{' '}
        <button
          type="button"
          onClick={() => { setState('idle'); setPhone(''); }}
          className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          Re-subscribe
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border dark:border-dark-border p-4">
      <p className="text-sm font-medium text-text-DEFAULT dark:text-dark-text mb-3">
        Get SMS alerts for this shelter
      </p>
      <form onSubmit={handleSubscribe} noValidate className="flex flex-col gap-3">
        <div>
          <label htmlFor="alert-phone" className="sr-only">
            Phone number
          </label>
          <input
            id="alert-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 867-5309"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); if (state === 'error') setState('idle'); }}
            disabled={state === 'loading'}
            aria-invalid={state === 'error'}
            aria-describedby={state === 'error' ? 'alert-phone-error' : undefined}
            className="w-full rounded border border-border dark:border-dark-border bg-white dark:bg-dark-surface
              text-text-DEFAULT dark:text-dark-text placeholder-text-subtle dark:placeholder-dark-subtle
              px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500
              disabled:opacity-50"
          />
          {state === 'error' && (
            <p id="alert-phone-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={state === 'loading'}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
              dark:focus:ring-offset-dark-bg disabled:opacity-50 transition-colors"
          >
            {state === 'loading' ? 'Subscribing…' : 'Subscribe'}
          </button>
          {phone.trim() && isValid && (
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={state === 'loading'}
              className="text-sm text-text-subtle dark:text-dark-subtle underline hover:no-underline
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded
                disabled:opacity-50"
            >
              Unsubscribe
            </button>
          )}
        </div>
      </form>
      <p className="mt-2 text-xs text-text-subtle dark:text-dark-subtle">
        US numbers only. Reply STOP at any time to unsubscribe.
      </p>
    </div>
  );
}
