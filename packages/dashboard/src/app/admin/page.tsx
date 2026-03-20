import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listRegistryEntries, type RegistryEntry } from '@/lib/registry';
import { getAllDonations } from '@/lib/donations';
import { AddShelterForm } from '@/components/AddShelterForm';
import { RemoveShelterButton } from '@/components/RemoveShelterButton';
import { MarkDeliveredButton } from '@/components/MarkDeliveredButton';
import type { DonationRecord } from '@/types/shelter';

const STATUS_COLORS: Record<string, string> = {
  PLEDGED: 'bg-yellow-100 text-yellow-800',
  IN_TRANSIT: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function AdminPage() {
  // Session is already guaranteed by the admin layout auth guard
  await getServerSession(authOptions);

  const [entries, donations] = await Promise.all([
    listRegistryEntries(),
    getAllDonations(),
  ]);

  const sortedDonations: DonationRecord[] = [...donations].sort(
    (a: DonationRecord, b: DonationRecord) => new Date(b.pledgedAt).getTime() - new Date(a.pledgedAt).getTime()
  );

  const pendingCount = donations.filter((d: DonationRecord) => d.status !== 'DELIVERED').length;

  return (
    <div className="max-w-3xl space-y-10">
      {/* Registered Shelters */}
      <section aria-label="Registered shelters">
        <h3 className="text-lg font-semibold text-text mb-4">Registered Shelters</h3>

        {entries.length === 0 ? (
          <p className="text-text-muted mb-6">No shelters registered yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border border border-surface-border rounded-lg overflow-hidden bg-white mb-8">
            {entries.map((entry: RegistryEntry) => (
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
      </section>

      {/* Pending Donations */}
      <section aria-label="Pending donations">
        <h3 className="text-lg font-semibold text-text mb-4">
          Pending Donations
          {pendingCount > 0 && (
            <span className="ml-2 text-sm font-normal text-text-subtle">
              ({pendingCount} pending)
            </span>
          )}
        </h3>

        {sortedDonations.length === 0 ? (
          <p className="text-text-muted">No donation pledges yet.</p>
        ) : (
          <div className="border border-surface-border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-surface-border">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-text">Shelter</th>
                  <th className="text-left px-4 py-2 font-medium text-text">Donor</th>
                  <th className="text-left px-4 py-2 font-medium text-text">Items</th>
                  <th className="text-left px-4 py-2 font-medium text-text">Pledged</th>
                  <th className="text-left px-4 py-2 font-medium text-text">Status</th>
                  <th className="px-4 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {sortedDonations.map((donation) => (
                  <tr key={donation.donationId}>
                    <td className="px-4 py-3 text-text">{donation.shelterName}</td>
                    <td className="px-4 py-3 text-text">
                      {donation.donorName || (
                        <span className="text-text-subtle italic">Anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text">
                      <ul className="space-y-0.5 list-none">
                        {donation.items.map((it, i) => (
                          <li key={i} className="text-xs">
                            {it.quantity}× {it.item}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-text-subtle whitespace-nowrap">
                      {formatDate(donation.pledgedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[donation.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {donation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {donation.status !== 'DELIVERED' && (
                        <MarkDeliveredButton
                          donationId={donation.donationId}
                          userId={donation.userId}
                          currentStatus={donation.status}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
