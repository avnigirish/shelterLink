import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'ShelterLink — Real-time shelter capacity',
  description: 'Live shelter bed availability, needs, and community coordination for volunteers and donors.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen text-gray-900 dark:text-gray-100">
        <ThemeProvider>
          <Header />
          {/* Hero welcome banner — home page only via CSS, always rendered for SSR */}
          <div className="bg-gradient-to-r from-brand-500 to-amber-400 dark:from-brand-800 dark:to-brand-700 text-white">
            <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">
                Community · Coordination · Care
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">
                Find shelter. Give help. Stay connected.
              </h1>
              <p className="text-sm sm:text-base opacity-90 max-w-xl">
                Real-time bed availability and supply needs from shelters in your community —
                updated by staff, visible to everyone.
              </p>
            </div>
          </div>
          <main className="px-4 py-8 max-w-5xl mx-auto">{children}</main>
          <footer className="mt-16 border-t border-surface-border dark:border-dark-border py-6 text-center text-xs text-text-faint dark:text-dark-subtle">
            ShelterLink · Built for the AWS Reachback Hackathon · MIT License
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
