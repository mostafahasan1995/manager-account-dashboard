import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { playerSearchSchema } from '@/app/search-schemas';
import { renderWithProviders } from '@/test/utils';

import { PlayerFilters } from './player-filters';

const renderFilters = (route = '/players') =>
  renderWithProviders(<PlayerFilters />, {
    route,
    routePath: '/players',
    validateSearch: playerSearchSchema,
  });

describe('PlayerFilters', () => {
  it('writes what was typed into the URL', async () => {
    const { user, location } = renderFilters();

    await user.type(await screen.findByLabelText('Search players'), 'maya');

    await waitFor(() => {
      expect(location()).toContain('search=maya');
    });
  });

  it('starts from the URL and can clear the search out of it again', async () => {
    const { user, location } = renderFilters('/players?search=maya');

    const input = await screen.findByLabelText('Search players');
    expect(input).toHaveValue('maya');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => {
      expect(location()).not.toContain('search');
    });
    expect(input).toHaveValue('');
  });

  it('puts the chosen status in the URL', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByLabelText('Status'));
    await user.click(await screen.findByRole('option', { name: 'Suspended' }));

    await waitFor(() => {
      expect(location()).toContain('status=SUSPENDED');
    });
  });

  it('filters to the players who cannot be credited, and back again', async () => {
    const { user, location } = renderFilters();

    const toggle = await screen.findByRole('button', { name: 'Waiting for Ichancy' });
    await user.click(toggle);

    await waitFor(() => {
      expect(location()).toContain('status=PENDING_ICHANCY');
    });
    expect(location()).toContain('linked=false');
    expect(screen.getByRole('button', { name: 'Waiting for Ichancy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Waiting for Ichancy' }));

    await waitFor(() => {
      expect(location()).not.toContain('status');
    });
    expect(location()).not.toContain('linked');
  });

  it('clears every filter at once and drops them from the query string', async () => {
    const { user, location } = renderFilters(
      '/players?search=maya&status=SUSPENDED&linked=true&offset=20',
    );

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(location()).toBe('/players');
    });
    expect(screen.getByLabelText('Search players')).toHaveValue('');
  });

  it('offers "Not linked" as a filter of its own', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByLabelText('Ichancy linked'));
    await user.click(await screen.findByRole('option', { name: 'Not linked' }));

    await waitFor(() => {
      expect(location()).toContain('linked=false');
    });
  });
});
