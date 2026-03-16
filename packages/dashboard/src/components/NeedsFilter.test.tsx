import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { NeedsFilter } from './NeedsFilter';
import type { NeedsItem } from '@/types/shelter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const needs: NeedsItem[] = [
  { item: 'blankets', priority: 'CRITICAL' },
  { item: 'water', priority: 'HIGH' },
  { item: 'canned food', priority: 'MEDIUM' },
  { item: 'socks', priority: 'LOW' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NeedsFilter', () => {
  it('renders all needs when "All" filter is active by default', () => {
    render(<NeedsFilter needs={needs} />);
    expect(screen.getByText('blankets')).toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
    expect(screen.getByText('canned food')).toBeInTheDocument();
    expect(screen.getByText('socks')).toBeInTheDocument();
  });

  it('"All" button has aria-pressed=true by default', () => {
    render(<NeedsFilter needs={needs} />);
    const allBtn = screen.getByRole('button', { name: 'All' });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('other filter buttons have aria-pressed=false by default', () => {
    render(<NeedsFilter needs={needs} />);
    for (const label of ['Critical', 'High', 'Medium', 'Low']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('clicking "Critical" sets aria-pressed=true on that button and false on others', async () => {
    const user = userEvent.setup();
    render(<NeedsFilter needs={needs} />);

    await user.click(screen.getByRole('button', { name: 'Critical' }));

    expect(screen.getByRole('button', { name: 'Critical' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('filters list to only Critical items when "Critical" is selected', async () => {
    const user = userEvent.setup();
    render(<NeedsFilter needs={needs} />);

    await user.click(screen.getByRole('button', { name: 'Critical' }));

    expect(screen.getByText('blankets')).toBeInTheDocument();
    expect(screen.queryByText('water')).not.toBeInTheDocument();
    expect(screen.queryByText('canned food')).not.toBeInTheDocument();
    expect(screen.queryByText('socks')).not.toBeInTheDocument();
  });

  it('filters list to only High items when "High" is selected', async () => {
    const user = userEvent.setup();
    render(<NeedsFilter needs={needs} />);

    await user.click(screen.getByRole('button', { name: 'High' }));

    expect(screen.queryByText('blankets')).not.toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
  });

  it('shows "No current needs." when filtered list is empty', async () => {
    const user = userEvent.setup();
    // Only CRITICAL items — selecting LOW should yield empty list
    const criticalOnly: NeedsItem[] = [{ item: 'blankets', priority: 'CRITICAL' }];
    render(<NeedsFilter needs={criticalOnly} />);

    await user.click(screen.getByRole('button', { name: 'Low' }));

    expect(screen.getByText('No current needs.')).toBeInTheDocument();
  });

  it('shows "No current needs." when needs prop is empty', () => {
    render(<NeedsFilter needs={[]} />);
    expect(screen.getByText('No current needs.')).toBeInTheDocument();
  });

  it('clicking "All" after a filter restores full list', async () => {
    const user = userEvent.setup();
    render(<NeedsFilter needs={needs} />);

    await user.click(screen.getByRole('button', { name: 'Critical' }));
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByText('blankets')).toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
    expect(screen.getByText('canned food')).toBeInTheDocument();
    expect(screen.getByText('socks')).toBeInTheDocument();
  });

  it('each need item shows its priority badge', () => {
    render(<NeedsFilter needs={needs} />);
    expect(screen.getByLabelText('Priority: Critical')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority: High')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority: Medium')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority: Low')).toBeInTheDocument();
  });
});
