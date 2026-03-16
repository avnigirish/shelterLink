import { describe, it, expect } from 'vitest';
import { formatConfirmation, formatError } from './prettyPrinter';
import type { CapacityRecord } from './types';

describe('formatConfirmation', () => {
  it('formats beds and status only', () => {
    const record: CapacityRecord = { beds: 12, capacity: 20, status: 'OPEN', needsList: [] };
    const result = formatConfirmation(record);
    expect(result).toContain('BEDS 12/20');
    expect(result).toContain('STATUS OPEN');
    expect(result).not.toContain('NEEDS');
  });

  it('formats beds, status, and needs with priorities', () => {
    const record: CapacityRecord = {
      beds: 5, capacity: 10, status: 'OPEN',
      needsList: [
        { item: 'blankets', priority: 'HIGH' },
        { item: 'water', priority: 'CRITICAL' },
      ],
    };
    const result = formatConfirmation(record);
    expect(result).toContain('NEEDS blankets:HIGH, water:CRITICAL');
  });

  it('omits fulfilled needs from output', () => {
    const record: CapacityRecord = {
      beds: 5, capacity: 10, status: 'OPEN',
      needsList: [
        { item: 'blankets', priority: 'HIGH', fulfilled: true },
        { item: 'water', priority: 'CRITICAL' },
      ],
    };
    const result = formatConfirmation(record);
    expect(result).not.toContain('blankets');
    expect(result).toContain('water:CRITICAL');
  });

  it('starts with "Updated:"', () => {
    const record: CapacityRecord = { beds: 0, capacity: 20, status: 'FULL', needsList: [] };
    expect(formatConfirmation(record)).toMatch(/^Updated:/);
  });

  it('formats FULL status correctly', () => {
    const record: CapacityRecord = { beds: 0, capacity: 20, status: 'FULL', needsList: [] };
    expect(formatConfirmation(record)).toContain('STATUS FULL');
  });

  it('formats CLOSED status correctly', () => {
    const record: CapacityRecord = { beds: 0, capacity: 0, status: 'CLOSED', needsList: [] };
    expect(formatConfirmation(record)).toContain('STATUS CLOSED');
  });
});

describe('formatError', () => {
  it('starts with "Error:"', () => {
    expect(formatError('some error')).toMatch(/^Error:/);
  });

  it('includes the error message', () => {
    expect(formatError('Missing BEDS field')).toContain('Missing BEDS field');
  });

  it('includes an example format', () => {
    expect(formatError('bad input')).toContain('BEDS');
  });
});
