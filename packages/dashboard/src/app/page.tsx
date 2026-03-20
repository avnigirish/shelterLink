import { getAllShelters } from '@/lib/db';
import { ShelterList } from '@/components/ShelterList';

export default async function HomePage() {
  const shelters = await getAllShelters();

  return (
    <section aria-label="Shelter capacity list">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          Shelters near you
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click any shelter to see needs, inventory, and community chat.
        </p>
      </div>
      <ShelterList initialShelters={shelters} />
    </section>
  );
}
