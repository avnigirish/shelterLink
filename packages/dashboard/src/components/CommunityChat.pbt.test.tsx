// Feature: community-activity-feed
// Property-based tests for CommunityChat rendering (P3, P4)

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { CommunityChat } from './CommunityChat';
import type { ChatMessage } from '@/types/shelter';

// ---------------------------------------------------------------------------
// USER_TYPE_COLORS mirror — must stay in sync with CommunityChat.tsx
// ---------------------------------------------------------------------------

const USER_TYPE_COLORS: Record<string, string> = {
  VOLUNTEER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DONOR:     'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  STAFF:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render CommunityChat with a single message and return the <li> element. */
function renderMessage(msg: ChatMessage): HTMLElement {
  render(
    <CommunityChat shelterId={msg.roomId} initialMessages={[msg]} />
  );
  // The message list items — skip the empty-state <li> if present
  const items = screen.getAllByRole('listitem');
  // The last rendered listitem is our message
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Property 3: Advocate message rendering
// For any ChatMessage where isAdvocateMessage returns true
// (senderName === "Community Advocate" && userType === "ADMIN"),
// the rendered <li> must:
//   - contain the teal background class
//   - render senderName in teal text
//   - render message body in teal text with font-medium
//   - NOT render a UserType badge element
// Validates: Requirements 2.1, 2.2, 2.3, 2.4
// ---------------------------------------------------------------------------

describe('P3: Advocate message rendering', () => {
  it('renders teal styling and no badge for any advocate ChatMessage', () => {
    fc.assert(
      fc.property(
        fc.record({
          senderName: fc.constant('Community Advocate'),
          userType: fc.constant('ADMIN' as const),
          message: fc.string(),
          roomId: fc.string({ minLength: 1 }),
          timestamp: fc.date().map((d) => d.toISOString()),
        }),
        (msg: ChatMessage) => {
          const { unmount } = render(
            <CommunityChat shelterId={msg.roomId} initialMessages={[msg]} />
          );

          const items = screen.getAllByRole('listitem');
          const li = items[items.length - 1];

          // Req 2.1 — teal background on the <li>
          const hasTealBg =
            li.className.includes('bg-teal-50') ||
            li.className.includes('teal-900/10');
          if (!hasTealBg) { unmount(); return false; }

          // Req 2.2 — sender name rendered in teal text
          const senderSpan = li.querySelector('span.text-teal-700, span.\\!text-teal-700') ??
            Array.from(li.querySelectorAll('span')).find(
              (el) => el.className.includes('text-teal-700') || el.className.includes('teal-300')
            );
          if (!senderSpan || !senderSpan.textContent?.includes('Community Advocate')) {
            unmount();
            return false;
          }

          // Req 2.3 — message body in teal with font-medium
          const msgP = li.querySelector('p');
          if (!msgP) { unmount(); return false; }
          const hasTealMsg =
            msgP.className.includes('text-teal-800') ||
            msgP.className.includes('teal-200');
          const hasFontMedium = msgP.className.includes('font-medium');
          if (!hasTealMsg || !hasFontMedium) { unmount(); return false; }

          // Req 2.4 — no UserType badge (aria-label="User type: …")
          const badge = li.querySelector('[aria-label^="User type:"]');
          if (badge) { unmount(); return false; }

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Non-advocate message badge rendering
// For any ChatMessage where isAdvocateMessage returns false,
// the rendered output must contain a badge element whose CSS classes
// match USER_TYPE_COLORS[msg.userType].
// Validates: Requirements 2.5
// ---------------------------------------------------------------------------

describe('P4: Non-advocate message badge rendering', () => {
  it('renders a correctly-colored UserType badge for any non-advocate message', () => {
    fc.assert(
      fc.property(
        fc.record({
          userType: fc.constantFrom('VOLUNTEER' as const, 'DONOR' as const, 'STAFF' as const),
          senderName: fc.string().filter((s) => s !== 'Community Advocate'),
          message: fc.string(),
          roomId: fc.string({ minLength: 1 }),
          timestamp: fc.date().map((d) => d.toISOString()),
        }),
        (msg: ChatMessage) => {
          const { unmount } = render(
            <CommunityChat shelterId={msg.roomId} initialMessages={[msg]} />
          );

          const items = screen.getAllByRole('listitem');
          const li = items[items.length - 1];

          // Badge must be present
          const badge = li.querySelector('[aria-label^="User type:"]');
          if (!badge) { unmount(); return false; }

          // Badge classes must include the expected color tokens for this userType
          const expectedClasses = USER_TYPE_COLORS[msg.userType].split(' ');
          const badgeClass = badge.className;
          const allPresent = expectedClasses.every((cls) => badgeClass.includes(cls));

          unmount();
          return allPresent;
        }
      ),
      { numRuns: 100 }
    );
  });
});
