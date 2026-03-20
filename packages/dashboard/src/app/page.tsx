import { getAllShelters } from '@/lib/db';
import { ShelterList } from '@/components/ShelterList';

export default async function HomePage() {
  const shelters = await getAllShelters();

  return (
    <section aria-label="Shelter capacity list">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-DEFAULT dark:text-dark-text mb-1">
          Shelters across the region
        </h2>
        <p className="text-sm text-text-subtle dark:text-dark-muted">
          Click any shelter to see needs, inventory, and community chat.
        </p>
      </div>
      <ShelterList initialShelters={shelters} />
    </section>
  );
}
