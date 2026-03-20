// Feature: community-activity-feed
// Unit tests for admin page empty state and member rendering
// Requirements: 4.1, 4.2, 4.3, 4.5, 4.6

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import type { MockUser } from '@/lib/mockUsers';

// ---------------------------------------------------------------------------
// Mutable store — the mock module reads from this array so tests can swap it
// ---------------------------------------------------------------------------

const mockUsersStore: MockUser[] = [];

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { name: 'Admin' } }),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));

vi.mock('@/lib/registry', () => ({
  listRegistryEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/donations', () => ({
  getAllDonations: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/components/AddShelterForm', () => ({
  AddShelterForm: () => React.createElement('div', { 'data-testid': 'add-shelter-form' }),
}));

vi.mock('@/components/RemoveShelterButton', () => ({
  RemoveShelterButton: () => React.createElement('button', null, 'Remove'),
}));

vi.mock('@/components/MarkDeliveredButton', () => ({
  MarkDeliveredButton: () => React.createElement('button', null, 'Mark Delivered'),
}));

// MOCK_USERS is a getter that always reads from mockUsersStore, so tests can
// splice/push into mockUsersStore without re-importing the module.
vi.mock('@/lib/mockUsers', () => ({
  get MOCK_USERS() { return mockUsersStore; },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_TYPE_COLORS: Record<string, string> = {
  VOLUNTEER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DONOR:     'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  STAFF:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    userId: 'user-test',
    name: 'Test User',
    email: 'test@example.com',
    userType: 'VOLUNTEER',
    joinedAt: new Date('2024-06-15T00:00:00Z').toISOString(),
    activitySummary: 'Delivered blankets to Shelter A',
    donationIds: [],
    ...overrides,
  };
}

/** Render the admin page server component by awaiting its async default export. */
async function renderAdminPage() {
  const { default: AdminPage } = await import('./page');
  const jsx = await AdminPage();
  render(jsx as React.ReactElement);
}

// Reset the store before each test
beforeEach(() => {
  mockUsersStore.splice(0);
});

// ---------------------------------------------------------------------------
// Req 4.1 — renders all MOCK_USERS rows
// ---------------------------------------------------------------------------

describe('Community Members section — renders all rows', () => {
  it('renders a row for every user in MOCK_USERS', async () => {
    mockUsersStore.push(
      makeUser({ userId: 'u1', name: 'Alice Johnson', email: 'alice@example.com' }),
      makeUser({ userId: 'u2', name: 'Bob Martinez',  email: 'bob@example.com' }),
      makeUser({ userId: 'u3', name: 'Carol Lee',     email: 'carol@example.com' }),
    );
    await renderAdminPage();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Martinez')).toBeInTheDocument();
    expect(screen.getByText('Carol Lee')).toBeInTheDocument();
  });

  it('renders the email for each user', async () => {
    mockUsersStore.push(
      makeUser({ userId: 'u1', name: 'Alice Johnson', email: 'alice@example.com' }),
      makeUser({ userId: 'u2', name: 'Bob Martinez',  email: 'bob@example.com' }),
    );
    await renderAdminPage();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 4.5 — member count subtitle
// ---------------------------------------------------------------------------

describe('Community Members section — member count subtitle', () => {
  it('shows the correct member count next to the heading', async () => {
    mockUsersStore.push(
      makeUser({ userId: 'u1' }),
      makeUser({ userId: 'u2' }),
    );
    await renderAdminPage();
    expect(screen.getByText('(2 members)')).toBeInTheDocument();
  });

  it('shows (1 members) for a single user', async () => {
    mockUsersStore.push(makeUser({ userId: 'u1' }));
    await renderAdminPage();
    expect(screen.getByText('(1 members)')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 4.6 — empty state
// ---------------------------------------------------------------------------

describe('Community Members section — empty state', () => {
  it('renders "No community members yet." when MOCK_USERS is empty', async () => {
    // mockUsersStore is already empty from beforeEach
    await renderAdminPage();
    expect(screen.getByText(/No community members yet/i)).toBeInTheDocument();
  });

  it('shows (0 members) in the subtitle when MOCK_USERS is empty', async () => {
    await renderAdminPage();
    expect(screen.getByText('(0 members)')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 4.2, 4.3 — row content: name, email, role badge, activitySummary, joinedAt
// ---------------------------------------------------------------------------

describe('Community Members section — row content', () => {
  const joinedAt = new Date('2024-03-10T00:00:00Z').toISOString();

  beforeEach(() => {
    mockUsersStore.push(
      makeUser({ userId: 'u-vol', name: 'Volunteer Val', email: 'val@example.com', userType: 'VOLUNTEER', joinedAt, activitySummary: 'Helped at Shelter B' }),
      makeUser({ userId: 'u-don', name: 'Donor Dan',     email: 'dan@example.com', userType: 'DONOR',     joinedAt, activitySummary: 'Pledged coats to Shelter C' }),
      makeUser({ userId: 'u-sta', name: 'Staff Sam',     email: 'sam@example.com', userType: 'STAFF',     joinedAt, activitySummary: 'Managed inventory at Shelter D' }),
    );
  });

  it('renders name and email for each user', async () => {
    await renderAdminPage();
    expect(screen.getByText('Volunteer Val')).toBeInTheDocument();
    expect(screen.getByText('val@example.com')).toBeInTheDocument();
    expect(screen.getByText('Donor Dan')).toBeInTheDocument();
    expect(screen.getByText('dan@example.com')).toBeInTheDocument();
    expect(screen.getByText('Staff Sam')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
  });

  it('renders role badge text for each userType', async () => {
    await renderAdminPage();
    expect(screen.getByText('VOLUNTEER')).toBeInTheDocument();
    expect(screen.getByText('DONOR')).toBeInTheDocument();
    expect(screen.getByText('STAFF')).toBeInTheDocument();
  });

  it('renders VOLUNTEER badge with green color classes', async () => {
    await renderAdminPage();
    const badge = screen.getByText('VOLUNTEER');
    for (const cls of USER_TYPE_COLORS['VOLUNTEER'].split(' ')) {
      expect(badge.className).toContain(cls);
    }
  });

  it('renders DONOR badge with blue color classes', async () => {
    await renderAdminPage();
    const badge = screen.getByText('DONOR');
    for (const cls of USER_TYPE_COLORS['DONOR'].split(' ')) {
      expect(badge.className).toContain(cls);
    }
  });

  it('renders STAFF badge with purple color classes', async () => {
    await renderAdminPage();
    const badge = screen.getByText('STAFF');
    for (const cls of USER_TYPE_COLORS['STAFF'].split(' ')) {
      expect(badge.className).toContain(cls);
    }
  });

  it('renders activitySummary for each user', async () => {
    await renderAdminPage();
    expect(screen.getByText('Helped at Shelter B')).toBeInTheDocument();
    expect(screen.getByText('Pledged coats to Shelter C')).toBeInTheDocument();
    expect(screen.getByText('Managed inventory at Shelter D')).toBeInTheDocument();
  });

  it('renders formatted joinedAt date for each user', async () => {
    await renderAdminPage();
    const formatted = formatDate(joinedAt);
    // All three users share the same joinedAt — expect 3 occurrences
    const dateEls = screen.getAllByText(formatted);
    expect(dateEls.length).toBe(3);
  });
});
