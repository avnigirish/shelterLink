export interface MockUser {
  userId: string;
  name: string;
  email: string;
  userType: 'VOLUNTEER' | 'DONOR' | 'STAFF';
  joinedAt: string;
  activitySummary: string;
  donationIds: string[];
}

export const MOCK_USERS: MockUser[] = [
  {
    userId: 'user-alice',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    userType: 'DONOR',
    joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Pledged blankets & water bottles to Helping Hands',
    donationIds: ['donation-001'],
  },
  {
    userId: 'user-bob',
    name: 'Bob Martinez',
    email: 'bob@example.com',
    userType: 'DONOR',
    joinedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Diapers & formula in transit to Contact Ministries',
    donationIds: ['donation-002'],
  },
  {
    userId: 'user-carol',
    name: 'Carol Lee',
    email: 'carol@example.com',
    userType: 'VOLUNTEER',
    joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Delivered hygiene kits to Sojourn Shelter',
    donationIds: ['donation-003'],
  },
  {
    userId: 'user-david',
    name: 'David Kim',
    email: 'david@example.com',
    userType: 'DONOR',
    joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Pledged winter coats & gloves to Covenant House NJ',
    donationIds: ['donation-004'],
  },
  {
    userId: 'user-elena',
    name: 'Elena Vasquez',
    email: 'elena@example.com',
    userType: 'VOLUNTEER',
    joinedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Delivered blankets & socks to Bowery Mission',
    donationIds: ['donation-005'],
  },
  {
    userId: 'user-frank',
    name: 'Frank Okafor',
    email: 'frank@example.com',
    userType: 'DONOR',
    joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Canned food in transit to Central Union Mission',
    donationIds: ['donation-006'],
  },
  {
    userId: 'user-grace',
    name: 'Grace Nguyen',
    email: 'grace@example.com',
    userType: 'DONOR',
    joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Pledged children\'s clothing to Helping Hands',
    donationIds: ['donation-007'],
  },
  {
    userId: 'user-henry',
    name: 'Henry Patel',
    email: 'henry@example.com',
    userType: 'VOLUNTEER',
    joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    activitySummary: 'Delivered hygiene kits & blankets to Covenant House NJ',
    donationIds: ['donation-008'],
  },
];
