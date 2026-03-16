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

export interface ShelterRecord {
  shelterId: string;
  name: string;
  address: string;
  phone: string;
  beds: number;
  capacity: number;
  status: ShelterStatus;
  needsList: NeedsItem[];
  updatedAt: string;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
