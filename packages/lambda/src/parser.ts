import type { CapacityRecord, NeedsItem, ParseResult, Priority, ShelterStatus } from './types';

// BEDS <current>/<total> [STATUS <open|full|closed>] [NEEDS <item>[:<priority>], ...]
const BEDS_RE = /\bBEDS\s+(\d+)\s*\/\s*(\d+)/i;
const STATUS_RE = /\bSTATUS\s+(open|full|closed)\b/i;
const NEEDS_RE = /\bNEEDS\s+([\s\S]+?)(?=\bFULFILLED\b|$)/i;
const FULFILLED_RE = /\bFULFILLED\s+([\w\s,]+)/i;

const PRIORITY_MAP: Record<string, Priority> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

function deriveStatus(beds: number, capacity: number): ShelterStatus {
  if (capacity === 0) return 'CLOSED';
  const occupancy = beds / capacity;
  if (occupancy >= 1) return 'FULL';
  return 'OPEN';
}

function parseNeedsSegment(segment: string): NeedsItem[] {
  return segment
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(entry => {
      const colonIdx = entry.lastIndexOf(':');
      if (colonIdx === -1) {
        return { item: entry.trim(), priority: 'MEDIUM' as Priority };
      }
      const item = entry.slice(0, colonIdx).trim();
      const priorityRaw = entry.slice(colonIdx + 1).trim().toLowerCase();
      const priority: Priority = PRIORITY_MAP[priorityRaw] ?? 'MEDIUM';
      return { item, priority };
    });
}

export function parse(smsBody: string): ParseResult {
  const bedsMatch = BEDS_RE.exec(smsBody);
  if (!bedsMatch) {
    return { ok: false, error: 'Missing BEDS field. Expected format: BEDS <current>/<total>' };
  }

  const beds = parseInt(bedsMatch[1], 10);
  const capacity = parseInt(bedsMatch[2], 10);

  if (beds < 0 || capacity < 0) {
    return { ok: false, error: 'BEDS values must be non-negative integers' };
  }
  if (beds > capacity) {
    return { ok: false, error: 'Current beds cannot exceed total capacity' };
  }

  // Determine status: explicit STATUS keyword takes precedence, otherwise derive
  let status: ShelterStatus;
  const statusMatch = STATUS_RE.exec(smsBody);
  if (statusMatch) {
    status = statusMatch[1].toUpperCase() as ShelterStatus;
  } else {
    status = deriveStatus(beds, capacity);
  }

  // Parse NEEDS
  const needsList: NeedsItem[] = [];
  const needsMatch = NEEDS_RE.exec(smsBody);
  if (needsMatch) {
    const parsed = parseNeedsSegment(needsMatch[1]);
    needsList.push(...parsed);
  }

  // Parse FULFILLED — mark matching items as fulfilled
  const fulfilledMatch = FULFILLED_RE.exec(smsBody);
  if (fulfilledMatch) {
    const fulfilledItems = fulfilledMatch[1]
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);

    for (const need of needsList) {
      if (fulfilledItems.includes(need.item.toLowerCase())) {
        need.fulfilled = true;
      }
    }
  }

  const record: CapacityRecord = { beds, capacity, status, needsList };
  return { ok: true, record };
}
