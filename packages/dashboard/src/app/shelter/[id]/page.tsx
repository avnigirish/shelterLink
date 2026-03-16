import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getShelterById } from '@/lib/db';
import { PRIORITY_ORDER } from '@/types/shelter';
import { NeedsFilter } from '@/components/NeedsFilter';

export default async function ShelterDetailPage({ params }: { params: { id: string } }) {
  const shelter = await getShelterById(params.id);
  if (!shelter) return notFound();

  const activeNeeds = shelter.needsList
    .filter((n) => !n.fulfilled)
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);

  return (
    <div className="max-w-2xl">
      <Link href="/" className="text-sm text-text-subtle hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 rounded">
        ← Back to all shelters
      </Link>
      <h2 className="text-2xl font-bold text-text mt-4 mb-1">{shelter.name}</h2>
      <p className="text-text-subtle text-sm mb-1">{shelter.address}</p>
      <p className="text-text-subtle text-sm mb-6">{shelter.phone}</p>

      <section aria-label="Current needs">
        <h3 className="text-lg font-semibold text-text mb-3">Current Needs</h3>
        <NeedsFilter needs={activeNeeds} />
      </section>
    </div>
  );
}
