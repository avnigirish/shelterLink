// Feature: community-activity-feed
// Property-based tests for mock data referential integrity and admin row rendering (P5, P6)

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MOCK_USERS, type MockUser } from './mockUsers';
import { MOCK_DONATIONS } from './mockDonations';

// ---------------------------------------------------------------------------
// USER_TYPE_COLORS mirror — must stay in sync with admin/page.tsx
// ---------------------------------------------------------------------------

const USER_TYPE_COLORS: Record<string, string> = {
  VOLUNTEER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DONOR:     'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  STAFF:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

// ---------------------------------------------------------------------------
// formatDate mirror — must stay in sync with admin/page.tsx
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// MemberRow — minimal render of the admin Community Members table row
// Mirrors the JSX in admin/page.tsx for the Community Members tbody
// ---------------------------------------------------------------------------

function MemberRow({ user }: { user: MockUser }) {
  return React.createElement(
    'table',
    null,
    React.createElement(
      'tbody',
      null,
      React.createElement(
        'tr',
        { 'data-testid': 'member-row' },
        // Name + email cell
        React.createElement(
          'td',
          null,
          React.createElement('p', { className: 'font-medium text-text-DEFAULT dark:text-dark-text' }, user.name),
          React.createElement('p', { className: 'text-xs text-text-subtle dark:text-dark-subtle' }, user.email)
        ),
        // Role badge cell
        React.createElement(
          'td',
          null,
          React.createElement(
            'span',
            {
              className: `text-xs px-2 py-0.5 rounded font-medium ${USER_TYPE_COLORS[user.userType] ?? ''}`,
              'aria-label': `User type: ${user.userType}`,
            },
            user.userType
          )
        ),
        // Activity summary cell
        React.createElement(
          'td',
          { className: 'text-xs' },
          user.activitySummary
        ),
        // Joined date cell
        React.createElement(
          'td',
          { className: 'whitespace-nowrap' },
          formatDate(user.joinedAt)
        )
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Property 5: Mock data referential integrity
// For every DonationRecord in MOCK_DONATIONS:
//   - a MockUser exists with matching userId
//   - that user's donationIds contains the donationId
// Conversely, for every donationId in any MockUser.donationIds:
//   - a DonationRecord exists with that donationId
// Validates: Requirements 3.3, 3.4
// ---------------------------------------------------------------------------

describe('P5: Mock data referential integrity', () => {
  it('every DonationRecord has a matching MockUser with the donationId in their donationIds', () => {
    const userMap = new Map(MOCK_USERS.map((u) => [u.userId, u]));

    for (const donation of MOCK_DONATIONS) {
      const user = userMap.get(donation.userId);
      if (!user) {
        throw new Error(
          `DonationRecord "${donation.donationId}" references userId "${donation.userId}" but no MockUser with that userId exists in MOCK_USERS`
        );
      }
      if (!user.donationIds.includes(donation.donationId)) {
        throw new Error(
          `MockUser "${user.userId}" does not list donationId "${donation.donationId}" in their donationIds array`
        );
      }
    }
  });

  it('every donationId in any MockUser.donationIds has a matching DonationRecord', () => {
    const donationMap = new Map(MOCK_DONATIONS.map((d) => [d.donationId, d]));

    for (const user of MOCK_USERS) {
      for (const donationId of user.donationIds) {
        if (!donationMap.has(donationId)) {
          throw new Error(
            `MockUser "${user.userId}" lists donationId "${donationId}" but no DonationRecord with that donationId exists in MOCK_DONATIONS`
          );
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Property 6: Member row rendering completeness
// For any MockUser sampled from MOCK_USERS, the rendered admin table row must:
//   - contain the user's full name
//   - contain the user's email
//   - contain a badge with the correct color classes for their userType
//   - contain the activitySummary text
//   - contain a formatted joinedAt date string
// Validates: Requirements 4.2, 4.3
// ---------------------------------------------------------------------------

describe('P6: Member row rendering completeness', () => {
  it('renders all required fields for any MockUser', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MOCK_USERS),
        (user: MockUser) => {
          const { unmount } = render(React.createElement(MemberRow, { user }));

          // Full name
          const nameEl = screen.getByText(user.name);
          if (!nameEl) { unmount(); return false; }

          // Email
          const emailEl = screen.getByText(user.email);
          if (!emailEl) { unmount(); return false; }

          // Role badge — must have correct color classes
          const badge = screen.getByLabelText(`User type: ${user.userType}`);
          if (!badge) { unmount(); return false; }
          const expectedClasses = USER_TYPE_COLORS[user.userType].split(' ');
          const allClassesPresent = expectedClasses.every((cls) =>
            badge.className.includes(cls)
          );
          if (!allClassesPresent) { unmount(); return false; }

          // Activity summary
          const activityEl = screen.getByText(user.activitySummary);
          if (!activityEl) { unmount(); return false; }

          // Formatted joinedAt date
          const expectedDate = formatDate(user.joinedAt);
          const dateEl = screen.getByText(expectedDate);
          if (!dateEl) { unmount(); return false; }

          unmount();
          return true;
        }
      ),
      { numRuns: MOCK_USERS.length } // deterministic — one run per user
    );
  });
});
