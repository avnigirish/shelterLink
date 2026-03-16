import type { CapacityRecord, NeedsItem } from './types';

/**
 * Formats a CapacityRecord into a confirmation SMS string.
 * Output is round-trip safe: parse(formatConfirmation(record)) produces an equivalent CapacityRecord.
 *
 * Example: "Updated: BEDS 12/20 STATUS OPEN NEEDS blankets:HIGH, water:CRITICAL"
 */
export function formatConfirmation(record: CapacityRecord): string {
  const parts: string[] = [];

  parts.push(`BEDS ${record.beds}/${record.capacity}`);
  parts.push(`STATUS ${record.status}`);

  const activeNeeds = record.needsList.filter((n: NeedsItem) => !n.fulfilled);
  if (activeNeeds.length > 0) {
    const needsStr = activeNeeds
      .map((n: NeedsItem) => `${n.item}:${n.priority}`)
      .join(', ');
    parts.push(`NEEDS ${needsStr}`);
  }

  return `Updated: ${parts.join(' ')}`;
}

/**
 * Formats an error reply with a descriptive message and example correct format.
 *
 * Example: "Error: Missing BEDS field. Example: BEDS 12/20 NEEDS blankets:high, water:critical"
 */
export function formatError(errorMsg: string): string {
  return `Error: ${errorMsg}. Example: BEDS 12/20 NEEDS blankets:high, water:critical`;
}
