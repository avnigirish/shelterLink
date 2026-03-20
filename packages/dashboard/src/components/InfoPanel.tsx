'use client';

import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FEATURES = [
  { icon: '📡', title: 'Live Capacity', desc: 'Shelter bed counts update in real time via SMS or web form.' },
  { icon: '🛒', title: 'Needs List', desc: 'Prioritized supply needs — filter by Critical, High, Medium, or Low.' },
  { icon: '📦', title: 'Inventory', desc: "See what each shelter has so you don't duplicate donations." },
  { icon: '💬', title: 'Community Chat', desc: 'Coordinate with other volunteers and donors per shelter.' },
  { icon: '🎁', title: 'Donation Pledges', desc: 'Pledge supplies and track delivery status.' },
  { icon: '🔐', title: 'Admin Panel', desc: 'Manage shelter registry and mark donations delivered.' },
];

const STEPS = [
  'Browse shelters on the home page — green means space available.',
  'Click a shelter to see its needs list, inventory, and chat.',
  'Use the filter buttons to find the most critical needs.',
  'Click "Pledge a Donation" to commit supplies and track delivery.',
  'Shelter staff send updates via the Lambda Function URL or SMS.',
];

export function InfoPanel({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const panelCls = [
    'panel-open fixed right-0 top-0 h-full w-full max-w-sm z-50 overflow-y-auto flex flex-col outline-none',
    'bg-surface-DEFAULT dark:bg-dark-surface',
    'shadow-panel dark:shadow-panel-dark',
  ].join(' ');

  const sectionHeadingCls = 'text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400 mb-3';
  const borderCls = 'border-surface-border dark:border-dark-border';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-40" aria-hidden="true" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="ShelterLink information panel" tabIndex={-1} className={panelCls}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${borderCls}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🏠</span>
            <span className="text-lg font-bold text-text-DEFAULT dark:text-dark-text">ShelterLink</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-2 rounded-lg text-text-subtle dark:text-dark-subtle hover:text-text-DEFAULT dark:hover:text-dark-text hover:bg-surface-subtle dark:hover:bg-dark-elevated focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-8 text-sm text-text-muted dark:text-dark-muted">

          <section>
            <p className="text-base leading-relaxed text-text-DEFAULT dark:text-dark-text">
              ShelterLink connects shelter staff, volunteers, and donors in real time — no app, no account needed.
            </p>
          </section>

          <section aria-labelledby="panel-nav">
            <h2 id="panel-nav" className={sectionHeadingCls}>Pages</h2>
            <nav>
              <ul className="space-y-1">
                {[
                  { href: '/', icon: '🏠', label: 'All Shelters', desc: 'Live capacity across every shelter' },
                  { href: '/supply-drive', icon: '📦', label: 'Supply Drive', desc: 'Top needed items right now' },
                ].map(({ href, icon, label, desc }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg
                        hover:bg-surface-subtle dark:hover:bg-dark-elevated
                        focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                    >
                      <span className="text-lg" aria-hidden="true">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-text-DEFAULT dark:text-dark-text">{label}</p>
                        <p className="text-xs text-text-subtle dark:text-dark-subtle">{desc}</p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </section>

          <section aria-labelledby="panel-features">
            <h2 id="panel-features" className={sectionHeadingCls}>Features</h2>
            <ul className="space-y-3">
              {FEATURES.map(({ icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
                  <div>
                    <p className="font-semibold text-text-DEFAULT dark:text-dark-text">{title}</p>
                    <p className="text-text-subtle dark:text-dark-subtle text-xs leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="panel-howto">
            <h2 id="panel-howto" className={sectionHeadingCls}>How to Use</h2>
            <ol className="space-y-3 list-none">
              {STEPS.map((text, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-text-subtle dark:text-dark-subtle text-xs leading-relaxed pt-0.5">{text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="panel-sms">
            <h2 id="panel-sms" className={sectionHeadingCls}>SMS Update Format</h2>
            <code className={`block bg-surface-subtle dark:bg-dark-elevated border ${borderCls} rounded-lg px-4 py-3 text-xs leading-relaxed text-text-DEFAULT dark:text-dark-text font-mono whitespace-pre-wrap`}>
              {`BEDS 12/50 STATUS open\nNEEDS blankets:high, water:critical\nFULFILLED socks`}
            </code>
            <p className="mt-2 text-xs text-text-faint dark:text-dark-subtle">Case-insensitive. Only BEDS is required.</p>
          </section>

          <section aria-labelledby="panel-contact">
            <h2 id="panel-contact" className={sectionHeadingCls}>Contact</h2>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <span aria-hidden="true">✉️</span>
                <a href="mailto:avni123.girish@gmail.com" className="text-brand-600 dark:text-brand-400 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
                  avni123.girish@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true">🐙</span>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
                  GitHub Repository
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true">🏆</span>
                <span className="text-text-subtle dark:text-dark-subtle">Built for the AWS Reachback Hackathon</span>
              </li>
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${borderCls} text-xs text-text-faint dark:text-dark-subtle`}>
          ShelterLink — Build for Impact · MIT License
        </div>

      </div>
    </>
  );
}
