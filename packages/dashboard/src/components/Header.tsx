'use client';

import { useState } from 'react';
import React from 'react';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import dynamic from 'next/dynamic';

const InfoPanel = dynamic(() => import('./InfoPanel').then((m) => m.InfoPanel), {
  ssr: false,
});

export function Header() {
  const { theme, toggle } = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30
        border-b border-surface-border dark:border-dark-border
        bg-surface-DEFAULT/80 dark:bg-dark-surface/80
        backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg"
          >
            <span className="text-2xl" aria-hidden="true">🏠</span>
            <div>
              <span className="text-lg font-bold text-text-DEFAULT dark:text-dark-text tracking-tight">
                Shelter<span className="text-brand-500">Link</span>
              </span>
              <p className="text-xs text-text-subtle dark:text-dark-subtle leading-none hidden sm:block">
                Real-time shelter capacity
              </p>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg
                text-text-subtle dark:text-dark-muted
                hover:bg-surface-subtle dark:hover:bg-dark-elevated
                focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Info / menu panel */}
            <button
              onClick={() => setPanelOpen(true)}
              aria-label="Open menu"
              aria-expanded={panelOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                bg-brand-500 hover:bg-brand-600 text-white
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                dark:focus:ring-offset-dark-surface"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      <InfoPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
