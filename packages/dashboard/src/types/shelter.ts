export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ShelterStatus = 'OPEN' | 'FULL' | 'CLOSED';

export type UserType = 'VOLUNTEER' | 'DONOR' | 'STAFF' | 'ADMIN';

export type DonationStatus = 'PLEDGED' | 'IN_TRANSIT' | 'DELIVERED';

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
  state: string;           // e.g. "NJ", "NY", "VA"
  website?: string;        // optional — links to the shelter's own site
  beds: number;
  capacity: number;
  status: ShelterStatus;
  needsList: NeedsItem[];
  inventory: Record<string, number>;
  updatedAt: string;
}

export interface ChatMessage {
  roomId: string;
  timestamp: string;
  senderName: string;
  message: string;
  userType: UserType;
}

export interface DonationItem {
  item: string;
  quantity: number;
}

export interface DonationRecord {
  userId: string;
  donationId: string;
  shelterId: string;
  shelterName: string;
  donorName: string;
  donorEmail: string;
  items: DonationItem[];
  status: DonationStatus;
  pledgedAt: string;
  deliveredAt?: string;
  notes?: string;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
