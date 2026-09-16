import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { paymentMethodSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { mockDestinations, mockPaymentMethods } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { DestinationList } from './destination-list';

/**
 * Destinations are the account numbers players are actually sent to, so this covers the three ways
 * the panel can mislead somebody: hiding a retired account without saying so, showing a cap in a
 * form nobody can read, and letting a deactivation happen without naming the account it stops.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The toast module is mocked for the whole file, so its call log has to be emptied between cases.
beforeEach(() => {
  vi.clearAllMocks();
});

const bank = mockPaymentMethods[0]!;
const wallet = mockPaymentMethods[1]!;
const cash = mockPaymentMethods[2]!;
const primary = mockDestinations[0]!;

const render = (
  method: (typeof mockPaymentMethods)[number] | null,
  options: Parameters<typeof renderWithProviders>[1] = {},
) =>
  renderWithProviders(<DestinationList method={method} />, {
    route: '/payment-methods',
    routePath: '/payment-methods',
    validateSearch: (search) => paymentMethodSearchSchema.parse(search),
    ...options,
  });

describe('DestinationList', () => {
  it('asks for a method before it claims anything', async () => {
    render(null);
    expect(await screen.findByText('No method selected')).toBeInTheDocument();
  });

  it('shows the account, its holder and its cap for the selected method', async () => {
    render(bank);

    expect(await screen.findByText(primary.label)).toBeInTheDocument();
    expect(screen.getByText(primary.accountIdentifier)).toBeInTheDocument();
    expect(screen.getAllByText('Cashier Holdings LLC').length).toBeGreaterThan(0);
    expect(screen.getByText('20,000,000.00')).toBeInTheDocument();
  });

  it('offers to copy the account rather than have it retyped', async () => {
    render(bank);
    await screen.findByText(primary.accountIdentifier);
    expect(screen.getAllByRole('button', { name: 'Copy' }).length).toBeGreaterThan(0);
  });

  it('keeps retired accounts out of the way until they are asked for', async () => {
    const { user, location } = render(wallet);

    expect(await screen.findByText('Primary wallet')).toBeInTheDocument();
    expect(screen.queryByText('Old wallet (closed)')).toBeNull();

    await user.click(screen.getByRole('switch', { name: 'Include inactive' }));

    expect(await screen.findByText('Old wallet (closed)')).toBeInTheDocument();
    await waitFor(() => {
      expect(location()).toContain('includeInactiveDestinations=true');
    });
  });

  it('points at the inactive toggle when a method looks empty', async () => {
    render(cash);
    expect(await screen.findByText('No active destinations on this method')).toBeInTheDocument();
    expect(screen.getByText(/turn on "include inactive"/i)).toBeInTheDocument();
  });

  it('opens the create form from the header and from the empty state', async () => {
    const first = render(cash);
    await first.user.click(await screen.findByRole('button', { name: 'Add destination' }));
    expect(
      await screen.findByRole('heading', { name: `New destination for ${cash.displayName}` }),
    ).toBeInTheDocument();
    await first.user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /new destination for/i })).toBeNull();
    });

    await first.user.click(screen.getByRole('button', { name: /add the first destination/i }));
    expect(
      await screen.findByRole('heading', { name: `New destination for ${cash.displayName}` }),
    ).toBeInTheDocument();
  });

  it('shows the failure rather than an empty table', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/payment-methods/:id/destinations`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL', message: 'The destinations did not load.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    const { user } = render(bank);

    expect(await screen.findByText('The destinations did not load.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('The destinations did not load.')).toBeInTheDocument();
  });

  it('lets a deactivation be backed out of', async () => {
    const { user } = render(bank);

    await user.click(await screen.findByRole('button', { name: `Deactivate ${primary.label}` }));
    await screen.findByRole('heading', { name: `Deactivate ${primary.label}?` });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: `Deactivate ${primary.label}?` })).toBeNull();
    });
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('names the account a deactivation would stop, and asks first', async () => {
    const { user } = render(bank);

    await user.click(await screen.findByRole('button', { name: `Deactivate ${primary.label}` }));

    expect(
      await screen.findByRole('heading', { name: `Deactivate ${primary.label}?` }),
    ).toBeInTheDocument();
    // The confirmation repeats the account, so nobody deactivates the row above the one they meant.
    expect(
      within(screen.getByRole('dialog')).getByText(primary.accountIdentifier),
    ).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        `${primary.label} deactivated`,
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
  });

  it('reports a deactivation the backend refused', async () => {
    server.use(
      http.delete(`${config.apiBaseUrl}/v1/admin/payment-destinations/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'DESTINATION_IN_USE', message: 'A deposit is waiting on it.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = render(bank);

    await user.click(await screen.findByRole('button', { name: `Deactivate ${primary.label}` }));
    await screen.findByRole('heading', { name: `Deactivate ${primary.label}?` });
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        `Could not deactivate ${primary.label}`,
        expect.objectContaining({ description: 'A deposit is waiting on it.' }),
      );
    });
  });

  it('opens the edit form on the destination that was clicked', async () => {
    const { user } = render(bank);

    await user.click(await screen.findByRole('button', { name: `Edit ${primary.label}` }));

    expect(
      await screen.findByRole('heading', { name: `Edit ${primary.label}` }),
    ).toBeInTheDocument();
  });

  it('gives a REVIEWER the accounts and none of the buttons', async () => {
    render(bank, { auth: { role: 'REVIEWER' } });

    expect(await screen.findByText(primary.accountIdentifier)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add destination/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Deactivate / })).toBeNull();
  });
});
