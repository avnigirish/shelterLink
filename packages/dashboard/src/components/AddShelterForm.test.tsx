import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddShelterForm } from './AddShelterForm';

beforeEach(() => {
  vi.restoreAllMocks();
});

function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  return async () => {
    await user.type(screen.getByPlaceholderText('shelter-005'), 's1');
    await user.type(screen.getByPlaceholderText('Shelter Name'), 'Test Shelter');
    await user.type(screen.getByPlaceholderText('+12175550000'), '+15550001111');
    await user.click(screen.getByRole('button', { name: 'Add Shelter' }));
  };
}

describe('AddShelterForm', () => {
  it('shows "Failed to add shelter" when API returns non-ok with no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }));

    const user = userEvent.setup();
    render(<AddShelterForm />);
    await fillAndSubmit(user)();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to add shelter');
    });
  });

  it('shows server error message when API returns one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'DynamoDB unavailable' }),
    }));

    const user = userEvent.setup();
    render(<AddShelterForm />);
    await fillAndSubmit(user)();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('DynamoDB unavailable');
    });
  });

  it('shows success message and clears fields on 201', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }));

    const user = userEvent.setup();
    render(<AddShelterForm />);
    await fillAndSubmit(user)();

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Shelter added successfully.');
    });
    expect(screen.getByPlaceholderText('shelter-005')).toHaveValue('');
  });

  it('shows "Failed to add shelter" when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const user = userEvent.setup();
    render(<AddShelterForm />);
    await fillAndSubmit(user)();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to add shelter');
    });
  });
});
