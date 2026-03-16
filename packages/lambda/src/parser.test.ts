import { describe, it, expect } from 'vitest';
import { parse } from './parser';

describe('Parser', () => {
  describe('valid inputs', () => {
    it('parses beds only', () => {
      const result = parse('BEDS 12/20');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.beds).toBe(12);
      expect(result.record.capacity).toBe(20);
      expect(result.record.status).toBe('OPEN');
      expect(result.record.needsList).toEqual([]);
    });

    it('parses beds at full capacity', () => {
      const result = parse('BEDS 20/20');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.status).toBe('FULL');
    });

    it('parses beds with zero capacity', () => {
      const result = parse('BEDS 0/0');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.status).toBe('CLOSED');
    });

    it('parses explicit STATUS open', () => {
      const result = parse('BEDS 5/20 STATUS open');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.status).toBe('OPEN');
    });

    it('parses explicit STATUS full', () => {
      const result = parse('BEDS 5/20 STATUS full');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.status).toBe('FULL');
    });

    it('parses explicit STATUS closed', () => {
      const result = parse('BEDS 5/20 STATUS closed');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.status).toBe('CLOSED');
    });

    it('parses needs with priorities', () => {
      const result = parse('BEDS 12/20 NEEDS blankets:high, water:critical');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.needsList).toEqual([
        { item: 'blankets', priority: 'HIGH' },
        { item: 'water', priority: 'CRITICAL' },
      ]);
    });

    it('assigns default MEDIUM priority when omitted', () => {
      const result = parse('BEDS 5/10 NEEDS socks');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.needsList[0]).toEqual({ item: 'socks', priority: 'MEDIUM' });
    });

    it('handles mixed priority and no-priority needs', () => {
      const result = parse('BEDS 5/10 NEEDS food:low, blankets, water:critical');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.needsList).toEqual([
        { item: 'food', priority: 'LOW' },
        { item: 'blankets', priority: 'MEDIUM' },
        { item: 'water', priority: 'CRITICAL' },
      ]);
    });

    it('is case-insensitive for keywords', () => {
      const result = parse('beds 8/15 needs coats:HIGH');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.beds).toBe(8);
      expect(result.record.needsList[0].priority).toBe('HIGH');
    });

    it('is whitespace-tolerant around slash', () => {
      const result = parse('BEDS 3 / 10');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.beds).toBe(3);
      expect(result.record.capacity).toBe(10);
    });

    it('handles FULFILLED syntax', () => {
      const result = parse('BEDS 5/10 NEEDS blankets:high, water FULFILLED blankets');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const blankets = result.record.needsList.find(n => n.item === 'blankets');
      expect(blankets?.fulfilled).toBe(true);
      const water = result.record.needsList.find(n => n.item === 'water');
      expect(water?.fulfilled).toBeUndefined();
    });

    it('adds fulfilled item not present in NEEDS list so handler can remove it from stored record', () => {
      const result = parse('BEDS 5/10 FULFILLED blankets');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const blankets = result.record.needsList.find(n => n.item === 'blankets');
      expect(blankets).toBeDefined();
      expect(blankets?.fulfilled).toBe(true);
      expect(blankets?.priority).toBe('MEDIUM');
    });

    it('does not duplicate a fulfilled item already in NEEDS list', () => {
      const result = parse('BEDS 5/10 NEEDS blankets:high FULFILLED blankets');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const matches = result.record.needsList.filter(n => n.item === 'blankets');
      expect(matches).toHaveLength(1);
      expect(matches[0].fulfilled).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('returns error when BEDS is missing', () => {
      const result = parse('NEEDS blankets:high');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/BEDS/i);
    });

    it('returns error for empty body', () => {
      const result = parse('');
      expect(result.ok).toBe(false);
    });

    it('returns error when beds exceed capacity', () => {
      const result = parse('BEDS 25/20');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/exceed/i);
    });

    it('returns error for negative bed count', () => {
      // The regex only matches \d+, so "BEDS -5/20" fails to match BEDS entirely
      const result = parse('BEDS -5/20');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/BEDS/i);
    });

    it('returns error for unknown/malformed format', () => {
      const result = parse('hello world');
      expect(result.ok).toBe(false);
    });
  });
});
