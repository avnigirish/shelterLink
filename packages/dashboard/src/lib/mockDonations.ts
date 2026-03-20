import type { DonationRecord } from '@/types/shelter';

// Mutable in-memory store so PATCH /api/admin/donations/[donationId] can update status
export const MOCK_DONATIONS: DonationRecord[] = [
  {
    userId: 'a1b2c3d4e5f6a7b8',
    donationId: 'donation-001',
    shelterId: 'shelter-001',
    shelterName: 'Helping Hands of Springfield',
    donorName: 'Alice Johnson',
    donorEmail: 'alice@example.com',
    items: [
      { item: 'blankets', quantity: 10 },
      { item: 'water bottles', quantity: 24 },
    ],
    status: 'PLEDGED',
    pledgedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    userId: 'b2c3d4e5f6a7b8c9',
    donationId: 'donation-002',
    shelterId: 'shelter-002',
    shelterName: 'Contact Ministries',
    donorName: 'Bob Martinez',
    donorEmail: 'bob@example.com',
    items: [
      { item: 'diapers', quantity: 50 },
      { item: 'baby formula', quantity: 6 },
    ],
    status: 'PLEDGED',
    pledgedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    userId: 'c3d4e5f6a7b8c9d0',
    donationId: 'donation-003',
    shelterId: 'shelter-003',
    shelterName: 'Sojourn Shelter and Services',
    donorName: 'Carol Lee',
    donorEmail: 'carol@example.com',
    items: [
      { item: 'hygiene kits', quantity: 20 },
    ],
    status: 'DELIVERED',
    pledgedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
