import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShelterById } from '@/lib/db';
import { PRIORITY_ORDER } from '@/types/shelter';
import { NeedsFilter } from '@/components/NeedsFilter';
import { InventoryPanel } from '@/components/InventoryPanel';
import { CommunityChat } from '@/components/CommunityChat';
import { getMessages } from '@/lib/mockChatStore';
import { AlertSubscribeForm } from '@/components/AlertSubscribeForm';
import dynamic from 'next/dynamic';

const AdvocateChat = dynamic(
  () => import('@/components/AdvocateChat').then((m) => m.AdvocateChat),
  { ssr: false }
);

export default async function ShelterDetailPage({ params }: { params: { id: string } }) {
  const [shelter, session] = await Promise.all([
    getShelterById(params.id),
    getServerSession(authOptions),
  ]);

  if (!shelter) return notFound();

  const USE_MOCK = process.env.USE_MOCK_DATA === 'true';
  const initialMessages = USE_MOCK
    ? getMessages(params.id)
    : [];

  const activeNeeds = shelter.needsList
    .filter((n) => !n.fulfilled)
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);

  const isAdmin = !!session;

  return (
    <>
      <div className="max-w-2xl fade-up">
        <Link href="/"
          className="text-sm text-text-subtle dark:text-dark-subtle hover:text-brand-600 dark:hover:text-brand-400
            hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            focus-visible:ring-brand-500 rounded transition-colors">
          ← Back to all shelters
        </Link>
        <h2 className="text-2xl font-bold text-text-DEFAULT dark:text-dark-text mt-4 mb-1">{shelter.name}</h2>
        <p className="text-text-subtle dark:text-dark-subtle text-sm mb-1">{shelter.address}</p>
        <p className="text-text-subtle dark:text-dark-subtle text-sm mb-1">{shelter.phone}</p>
        {shelter.website && (
          <a
            href={shelter.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            Visit website ↗
          </a>
        )}

        <section aria-label="Current needs">
          <h3 className="text-lg font-semibold text-text-DEFAULT dark:text-dark-text mb-3">Current Needs</h3>
          <NeedsFilter needs={activeNeeds} />
        </section>

        <InventoryPanel
          inventory={shelter.inventory}
          needsList={shelter.needsList}
          shelterId={params.id}
          isAdmin={isAdmin}
        />

        <div className="mt-8">
          <CommunityChat shelterId={params.id} initialMessages={initialMessages} />
        </div>

        <div className="mt-6">
          <AlertSubscribeForm shelterId={params.id} shelterName={shelter.name} />
        </div>

        <div className="mt-4">
          <Link
            href={`/donate/${params.id}`}
            className="inline-block px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
              rounded focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
              dark:focus:ring-offset-dark-bg transition-colors"
          >
            Pledge a Donation
          </Link>
        </div>
      </div>
      <AdvocateChat shelterId={params.id} context="shelter" />
    </>
  );
}
