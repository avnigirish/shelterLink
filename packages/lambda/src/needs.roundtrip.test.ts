/**
 * Property 2: Needs round-trip
 * parse(prettyPrint(record)).needsList deep-equals record.needsList
 * (active needs only — fulfilled items are intentionally stripped by formatConfirmation)
 *
 * Validates: Requirements 1.6, 3.2
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { parse } from './parser';
import { formatConfirmation } from './prettyPrinter';
import type { CapacityRecord, NeedsItem, Priority } from './types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------
const PRIORITIES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Generates a single word item name (letters only, lowercase, 2–12 chars) */
const arbItemName = fc
  .stringMatching(/^[a-z]{2,12}$/)
  .filter((s) => !/^(beds|status|needs|fulfilled|open|full|closed|critical|high|medium|low)$/i.test(s));

const arbPriority = fc.constantFrom(...PRIORITIES);

const arbNeedsItem: fc.Arbitrary<NeedsItem> = fc.record({
  item: arbItemName,
  priority: arbPriority,
});

/** Generates a list of 0–6 needs items with unique item names */
const arbNeedsList = fc
  .array(arbNeedsItem, { minLength: 0, maxLength: 6 })
  .map((items) => {
    // deduplicate by item name (case-insensitive)
    const seen = new Set<string>();
    return items.filter((n) => {
      const key = n.item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

const arbCapacityRecord: fc.Arbitrary<CapacityRecord> = fc
  .record({
    capacity: fc.integer({ min: 1, max: 200 }),
    beds: fc.integer({ min: 0, max: 200 }),
  })
  .filter(({ beds, capacity }) => beds <= capacity)
  .chain(({ beds, capacity }) =>
    arbNeedsList.map((needsList) => ({
      beds,
      capacity,
      // derive status from occupancy so it round-trips cleanly
      status: (beds >= capacity ? 'FULL' : 'OPEN') as CapacityRecord['status'],
      needsList,
    }))
  );

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------
describe('Needs round-trip property', () => {
  it('parse(prettyPrint(record)).needsList deep-equals record.needsList (active needs)', () => {
    fc.assert(
      fc.property(arbCapacityRecord, (record) => {
        const printed = formatConfirmation(record);
        const result = parse(printed);

        if (!result.ok) {
          throw new Error(`parse failed on: "${printed}" — ${result.error}`);
        }

        // Only active (non-fulfilled) needs are emitted by formatConfirmation
        const expectedNeeds = record.needsList.filter((n) => !n.fulfilled);
        const actualNeeds = result.record.needsList.filter((n) => !n.fulfilled);

        // Same length
        if (actualNeeds.length !== expectedNeeds.length) {
          throw new Error(
            `Length mismatch: expected ${expectedNeeds.length}, got ${actualNeeds.length}\n` +
              `Input: ${JSON.stringify(record)}\nPrinted: "${printed}"`
          );
        }

        // Same items in same order (formatConfirmation preserves order)
        for (let i = 0; i < expectedNeeds.length; i++) {
          const exp = expectedNeeds[i];
          const act = actualNeeds[i];
          if (act.item !== exp.item || act.priority !== exp.priority) {
            throw new Error(
              `Item mismatch at index ${i}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}\n` +
                `Input: ${JSON.stringify(record)}\nPrinted: "${printed}"`
            );
          }
        }
      }),
      { numRuns: 300, verbose: true }
    );
  });

  it('parse(prettyPrint(record)).beds and .capacity match original', () => {
    fc.assert(
      fc.property(arbCapacityRecord, (record) => {
        const printed = formatConfirmation(record);
        const result = parse(printed);
        if (!result.ok) throw new Error(`parse failed: ${result.error}`);
        return result.record.beds === record.beds && result.record.capacity === record.capacity;
      }),
      { numRuns: 300 }
    );
  });
});
