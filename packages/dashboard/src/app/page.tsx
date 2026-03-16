import { getAllShelters } from '@/lib/db';
import { ShelterList } from '@/components/ShelterList';

export default async function HomePage() {
  const shelters = await getAllShelters();

  return (
    <section aria-label="Shelter capacity list">
      <h2 className="text-2xl font-bold text-text mb-4">Shelter Availability</h2>
      <ShelterList initialShelters={shelters} />
    </section>
  );
}
