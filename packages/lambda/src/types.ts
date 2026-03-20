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

export type ParseResult =
  | { ok: true; record: CapacityRecord }
  | { ok: false; error: string };

// Inventory: item name → quantity (stored as DynamoDB Map on shelter record)
export type Inventory = Record<string, number>;

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
  items: DonationItem[];
  status: DonationStatus;
  pledgedAt: string;
  deliveredAt?: string;
  notes?: string;
}
