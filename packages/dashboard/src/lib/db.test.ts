import { describe, it, expect, vi } from 'vitest';

// Mock AWS SDK before importing db
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({ send: vi.fn() }),
  },
  ScanCommand: vi.fn(),
  GetCommand: vi.fn(),
}));

// Force mock mode: USE_MOCK is evaluated at module load time,
// so we set env vars before the dynamic import below.
vi.stubEnv('USE_MOCK_DATA', 'true');
vi.stubEnv('SHELTER_TABLE', '');

// Use dynamic import so env stubs are applied before module evaluation
const { getAllShelters, getShelterById } = await import('./db');
const { MOCK_SHELTERS } = await import('./mockData');

describe('getAllShelters (mock mode)', () => {
  it('returns all mock shelters', async () => {
    const result = await getAllShelters();
    expect(result).toHaveLength(MOCK_SHELTERS.length);
  });

  it('returns ShelterRecord objects with required fields', async () => {
    const result = await getAllShelters();
    for (const shelter of result) {
      expect(shelter).toHaveProperty('shelterId');
      expect(shelter).toHaveProperty('name');
      expect(shelter).toHaveProperty('beds');
      expect(shelter).toHaveProperty('capacity');
      expect(shelter).toHaveProperty('status');
      expect(shelter).toHaveProperty('needsList');
      expect(shelter).toHaveProperty('updatedAt');
    }
  });

  it('returns shelters with valid status values', async () => {
    const result = await getAllShelters();
    const validStatuses = ['OPEN', 'FULL', 'CLOSED'];
    for (const shelter of result) {
      expect(validStatuses).toContain(shelter.status);
    }
  });
});

describe('getShelterById (mock mode)', () => {
  it('returns the correct shelter by id', async () => {
    const first = MOCK_SHELTERS[0];
    const result = await getShelterById(first.shelterId);
    expect(result).not.toBeNull();
    expect(result?.shelterId).toBe(first.shelterId);
    expect(result?.name).toBe(first.name);
  });

  it('returns null for unknown id', async () => {
    const result = await getShelterById('nonexistent-id');
    expect(result).toBeNull();
  });

  it('returns shelter with correct needsList structure', async () => {
    const shelterWithNeeds = MOCK_SHELTERS.find(s => s.needsList.length > 0);
    if (!shelterWithNeeds) return; // skip if no shelter has needs
    const result = await getShelterById(shelterWithNeeds.shelterId);
    expect(result?.needsList.length).toBeGreaterThan(0);
    for (const need of result!.needsList) {
      expect(need).toHaveProperty('item');
      expect(need).toHaveProperty('priority');
    }
  });
});
