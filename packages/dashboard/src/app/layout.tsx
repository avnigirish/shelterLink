import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShelterLink',
  description: 'Real-time shelter capacity dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-muted text-text min-h-screen">
        <header className="bg-white border-b border-surface-border px-4 py-3">
          <h1 className="text-xl font-semibold text-text">ShelterLink</h1>
        </header>
        <main className="px-4 py-6 max-w-5xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
