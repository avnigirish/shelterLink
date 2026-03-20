import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listRegistryEntries, type RegistryEntry } from '@/lib/registry';
import { getAllDonations } from '@/lib/donations';
import { MOCK_USERS } from '@/lib/mockUsers';
import { AddShelterForm } from '@/components/AddShelterForm';
import { RemoveShelterButton } from '@/components/RemoveShelterButton';
import { MarkDeliveredButton } from '@/components/MarkDeliveredButton';
import type { DonationRecord } from '@/types/shelter';

const STATUS_COLORS: Record<string, string> = {
  PLEDGED:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  IN_TRANSIT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  DELIVERED:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const USER_TYPE_COLORS: Record<string, string> = {
  VOLUNTEER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DONOR:     'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  STAFF:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function AdminPage() {
  await getServerSession(authOptions);

  const [entries, donations] = await Promise.all([
    listRegistryEntries(),
    getAllDonations(),
  ]);

  const sortedDonations: DonationRecord[] = [...donations].sort(
    (a, b) => new Date(b.pledgedAt).getTime() - new Date(a.pledgedAt).getTime()
  );

  const pendingCount = donations.filter((d: DonationRecord) => d.status !== 'DELIVERED').length;

  return (
    <div className="max-w-3xl space-y-10">

      {/* Registered Shelters */}
      <section aria-label="Registered shelters">
        <h3 className="text-lg font-semibold text-text-DEFAULT dark:text-dark-text mb-4">
          Registered Shelters
        </h3>

        {entries.length === 0 ? (
          <p className="text-text-subtle dark:text-dark-subtle mb-6">No shelters registered yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border dark:divide-dark-border border border-surface-border dark:border-dark-border rounded-lg overflow-hidden bg-surface-DEFAULT dark:bg-dark-surface mb-8 list-none">
            {entries.map((entry: RegistryEntry) => (
              <li
                key={entry.shelterId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-text-DEFAULT dark:text-dark-text">{entry.name}</p>
                  <p className="text-sm text-text-subtle dark:text-dark-subtle font-mono">{entry.maskedPhone}</p>
                </div>
                <RemoveShelterButton shelterId={entry.shelterId} name={entry.name} />
              </li>
            ))}
          </ul>
        )}

        <section aria-label="Add shelter registration">
          <h3 className="text-lg font-semibold text-text-DEFAULT dark:text-dark-text mb-3">Add Shelter</h3>
          <AddShelterForm />
        </section>
      </section>

      {/* Pending Donations */}
      <section aria-label="Pending donations">
        <h3 className="text-lg font-semibold text-text-DEFAULT dark:text-dark-text mb-4">
          Pending Donations
          {pendingCount > 0 && (
            <span className="ml-2 text-sm font-normal text-text-subtle dark:text-dark-subtle">
              ({pendingCount} pending)
            </span>
          )}
        </h3>

        {sortedDonations.length === 0 ? (
          <p className="text-text-subtle dark:text-dark-subtle">No donation pledges yet.</p>
        ) : (
          <div className="border border-surface-border dark:border-dark-border rounded-lg overflow-hidden bg-surface-DEFAULT dark:bg-dark-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted dark:bg-dark-elevated border-b border-surface-border dark:border-dark-border">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Shelter</th>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Donor</th>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Items</th>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Pledged</th>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Status</th>
                  <th className="px-4 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-border">
                {sortedDonations.map((donation) => (
                  <tr key={donation.donationId}>
                    <td className="px-4 py-3 text-text-DEFAULT dark:text-dark-text">{donation.shelterName}</td>
                    <td className="px-4 py-3 text-text-DEFAULT dark:text-dark-text">
                      {donation.donorName || (
                        <span className="text-text-subtle dark:text-dark-subtle italic">Anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-DEFAULT dark:text-dark-text">
                      <ul className="space-y-0.5 list-none">
                        {donation.items.map((it, i) => (
                          <li key={i} className="text-xs">
                            {it.quantity}× {it.item}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-text-subtle dark:text-dark-subtle whitespace-nowrap">
                      {formatDate(donation.pledgedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[donation.status] ?? 'bg-surface-muted dark:bg-dark-elevated text-text-subtle dark:text-dark-subtle'}`}>
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

      {/* Community Members */}
      <section aria-label="Community members">
        <h3 className="text-lg font-semibold text-text-DEFAULT dark:text-dark-text mb-4">
          Community Members
          <span className="ml-2 text-sm font-normal text-text-subtle dark:text-dark-subtle">
            ({MOCK_USERS.length} members)
          </span>
        </h3>

        {MOCK_USERS.length === 0 ? (
          <p className="text-text-subtle dark:text-dark-subtle">No community members yet.</p>
        ) : (
          <div className="border border-surface-border dark:border-dark-border rounded-lg overflow-hidden bg-surface-DEFAULT dark:bg-dark-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted dark:bg-dark-elevated border-b border-surface-border dark:border-dark-border">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Role</th>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Recent Activity</th>
                  <th className="text-left px-4 py-2 font-medium text-text-DEFAULT dark:text-dark-text">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-border">
                {MOCK_USERS.map((user) => (
                  <tr key={user.userId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-DEFAULT dark:text-dark-text">{user.name}</p>
                      <p className="text-xs text-text-subtle dark:text-dark-subtle">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${USER_TYPE_COLORS[user.userType] ?? ''}`}>
                        {user.userType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted dark:text-dark-muted text-xs max-w-xs">
                      {user.activitySummary}
                    </td>
                    <td className="px-4 py-3 text-text-subtle dark:text-dark-subtle whitespace-nowrap">
                      {formatDate(user.joinedAt)}
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
