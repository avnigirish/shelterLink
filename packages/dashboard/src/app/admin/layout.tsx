import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  return (
    <div>
      <header className="border-b border-surface-border mb-6 pb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">ShelterLink Admin</h2>
        <span className="text-sm text-text-subtle">{session.user?.email}</span>
      </header>
      {children}
    </div>
  );
}
