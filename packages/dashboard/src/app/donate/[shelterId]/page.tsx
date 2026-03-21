import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getShelterById } from '@/lib/db';
import { DonationForm } from '@/components/DonationForm';

export default async function DonatePage({
  params,
  searchParams,
}: {
  params: { shelterId: string };
  searchParams?: { item?: string };
}) {
  const shelter = await getShelterById(params.shelterId);
  if (!shelter) return notFound();

  const activeNeeds = shelter.needsList.filter((n) => !n.fulfilled);
  const preselectedItem = searchParams?.item ?? '';

  return (
    <div className="max-w-lg">
      <Link
        href={`/shelter/${params.shelterId}`}
        className="text-sm text-text-subtle hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-text rounded"
      >
        ← Back to {shelter.name}
      </Link>

      <h2 className="text-2xl font-bold text-text mt-4 mb-1">Pledge a Donation</h2>
      <p className="text-text-subtle text-sm mb-6">
        Donating to <strong>{shelter.name}</strong>
      </p>

      <DonationForm
        shelterId={params.shelterId}
        shelterName={shelter.name}
        suggestedNeeds={activeNeeds}
        preselectedItem={preselectedItem}
      />
    </div>
  );
}
