import type { ShelterRecord } from '@/types/shelter';

// Real shelters sourced from shelterlistings.org/city/springfield-il.html
// Capacity, bed counts, and needs are simulated for demo purposes
export const MOCK_SHELTERS: ShelterRecord[] = [
  {
    shelterId: 'shelter-001',
    name: 'Helping Hands of Springfield',
    address: '2200 Shale St, Springfield, IL 62703',
    phone: '(217) 522-0048',
    beds: 14,
    capacity: 40,
    status: 'OPEN',
    needsList: [
      { item: 'blankets', priority: 'CRITICAL', fulfilled: false },
      { item: 'water bottles', priority: 'HIGH', fulfilled: false },
      { item: 'canned food', priority: 'MEDIUM', fulfilled: false },
      { item: 'socks', priority: 'LOW', fulfilled: false },
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    shelterId: 'shelter-002',
    name: 'Contact Ministries',
    address: '1100 E Adams St, Springfield, IL 62703',
    phone: '(217) 753-3939',
    beds: 0,
    capacity: 30,
    status: 'FULL',
    needsList: [
      { item: 'diapers', priority: 'CRITICAL', fulfilled: false },
      { item: 'baby formula', priority: 'HIGH', fulfilled: false },
      { item: 'hygiene kits', priority: 'MEDIUM', fulfilled: false },
    ],
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    shelterId: 'shelter-003',
    name: 'Sojourn Shelter and Services',
    address: '1800 Westchester Blvd, Springfield, IL 62704',
    phone: '(217) 726-5100',
    beds: 8,
    capacity: 25,
    status: 'OPEN',
    needsList: [],
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    shelterId: 'shelter-004',
    name: 'Inner City Mission',
    address: '1301 S Martin Luther King Jr Dr, Springfield, IL 62703',
    phone: '(217) 525-3940',
    beds: 0,
    capacity: 20,
    status: 'CLOSED',
    needsList: [
      { item: 'volunteers', priority: 'HIGH', fulfilled: false },
      { item: 'cleaning supplies', priority: 'MEDIUM', fulfilled: false },
    ],
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];
