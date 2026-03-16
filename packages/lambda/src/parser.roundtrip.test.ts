import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parse } from './parser';
import { formatConfirmation } from './prettyPrinter';
import type { CapacityRecord } from './types';

/**
 * Validates: Requirements 1.6
 *
 * Property 1: Round-trip consistency
 * parse(formatConfirmation(record)) produces an equivalent CapacityRecord.
 */

const arbPriority = fc.constantFrom('CRITICAL' as const, 'HIGH' as const, 'MEDIUM' as const, 'LOW' as const);

// Item names: lowercase letters only, no colons or commas (safe for SMS format)
const arbNeedsItem = fc.record({
  item: fc.stringMatching(/^[a-z]{2,10}$/),
  priority: arbPriority,
});

// Valid CapacityRecord: beds <= capacity, no fulfilled items (formatConfirmation omits them)
const arbCapacityRecord: fc.Arbitrary<CapacityRecord> = fc
  .record({
    capacity: fc.integer({ min: 1, max: 100 }),
    beds: fc.integer({ min: 0, max: 100 }),
    status: fc.constantFrom('OPEN' as const, 'FULL' as const, 'CLOSED' as const),
    needsList: fc.array(arbNeedsItem, { minLength: 0, maxLength: 5 }),
  })
  .filter(r => r.beds <= r.capacity)
  // Deduplicate needs items by name so round-trip comparison is unambiguous
  .filter(r => {
    const names = r.needsList.map(n => n.item);
    return new Set(names).size === names.length;
  });

describe('Parser round-trip property', () => {
  it('Property 1: parse(formatConfirmation(record)) produces equivalent CapacityRecord', () => {
    fc.assert(
      fc.property(arbCapacityRecord, (record: CapacityRecord) => {
        const sms = formatConfirmation(record);
        const result = parse(sms);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.record.beds).toBe(record.beds);
        expect(result.record.capacity).toBe(record.capacity);
        expect(result.record.status).toBe(record.status);

        // formatConfirmation only emits active (non-fulfilled) needs
        const activeOriginal = record.needsList.filter(n => !n.fulfilled);
        const activeParsed = result.record.needsList.filter(n => !n.fulfilled);

        expect(activeParsed).toHaveLength(activeOriginal.length);
        for (let i = 0; i < activeOriginal.length; i++) {
          expect(activeParsed[i].item).toBe(activeOriginal[i].item);
          expect(activeParsed[i].priority).toBe(activeOriginal[i].priority);
        }
      }),
      { numRuns: 200 }
    );
  });
});
