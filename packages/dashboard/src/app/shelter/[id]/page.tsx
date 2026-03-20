import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShelterById } from '@/lib/db';
import { PRIORITY_ORDER } from '@/types/shelter';
import { NeedsFilter } from '@/components/NeedsFilter';
import { InventoryPanel } from '@/components/InventoryPanel';
import { CommunityChat } from '@/components/CommunityChat';

export default async function ShelterDetailPage({ params }: { params: { id: string } }) {
  const [shelter, session] = await Promise.all([
    getShelterById(params.id),
    getServerSession(authOptions),
  ]);

  if (!shelter) return notFound();

  const activeNeeds = shelter.needsList
    .filter((n) => !n.fulfilled)
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);

  const isAdmin = !!session;

  return (
    <div className="max-w-2xl">
      <Link href="/" className="text-sm text-text-subtle hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-text rounded">
        ← Back to all shelters
      </Link>
      <h2 className="text-2xl font-bold text-text mt-4 mb-1">{shelter.name}</h2>
      <p className="text-text-subtle text-sm mb-1">{shelter.address}</p>
      <p className="text-text-subtle text-sm mb-6">{shelter.phone}</p>

      <section aria-label="Current needs">
        <h3 className="text-lg font-semibold text-text mb-3">Current Needs</h3>
        <NeedsFilter needs={activeNeeds} />
      </section>

      <InventoryPanel
        inventory={shelter.inventory}
        shelterId={params.id}
        isAdmin={isAdmin}
      />

      <div className="mt-8">
        <CommunityChat shelterId={params.id} initialMessages={[]} />
      </div>

      <div className="mt-6">
        <Link
          href={`/donate/${params.id}`}
          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          Pledge a Donation
        </Link>
      </div>
    </div>
  );
}
