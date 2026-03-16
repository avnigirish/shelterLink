export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ShelterStatus = 'OPEN' | 'FULL' | 'CLOSED';

export interface NeedsItem {
  item: string;
  priority: Priority;
  fulfilled?: boolean;
}

export interface CapacityRecord {
  beds: number;
  capacity: number;
  status: ShelterStatus;
  needsList: NeedsItem[];
  updatedAt?: string;
}

export type ParseResult =
  | { ok: true; record: CapacityRecord }
  | { ok: false; error: string };
