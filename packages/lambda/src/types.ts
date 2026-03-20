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

// ── SMS Broadcast Alerts ──────────────────────────────────────────────────────

export type SubscriptionStatus = 'ACTIVE' | 'UNSUBSCRIBED';

export type AlertTriggerType =
  | 'STATUS_FULL'
  | 'STATUS_CLOSED'
  | 'STATUS_OPEN'
  | 'CRITICAL_NEED';

export interface SubscriptionRecord {
  PK: string;           // SUBSCRIBER#<sha256(phone)>
  SK: string;           // SHELTER#<shelterId>
  phone: string;        // raw E.164 — used by Pinpoint for delivery
  shelterId: string;    // GSI partition key
  status: SubscriptionStatus; // GSI sort key
  subscribedAt: string; // ISO 8601
  updatedAt: string;    // ISO 8601
  // No ttl — subscriptions persist until explicitly unsubscribed
}

export interface AlertTrigger {
  type: AlertTriggerType;
  shelterId: string;
  shelterName: string;
  beds?: number;
  capacity?: number;
  newCriticalItems?: string[];
}
