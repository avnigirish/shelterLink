import { listRegistryEntries } from '@/lib/registry';
import { AddShelterForm } from '@/components/AddShelterForm';
import { RemoveShelterButton } from '@/components/RemoveShelterButton';

export default async function AdminPage() {
  const entries = await listRegistryEntries();

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-semibold text-text mb-4">Registered Shelters</h3>

      {entries.length === 0 ? (
        <p className="text-text-muted mb-6">No shelters registered yet.</p>
      ) : (
        <ul className="divide-y divide-surface-border border border-surface-border rounded-lg overflow-hidden bg-white mb-8">
          {entries.map((entry) => (
            <li
              key={entry.shelterId}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-medium text-text">{entry.name}</p>
                <p className="text-sm text-text-subtle font-mono">{entry.maskedPhone}</p>
              </div>
              <RemoveShelterButton shelterId={entry.shelterId} name={entry.name} />
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Add shelter registration">
        <h3 className="text-lg font-semibold text-text mb-3">Add Shelter</h3>
        <AddShelterForm />
      </section>
    </div>
  );
}
