import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { paymentMethodSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { ApiError } from '@/lib/api/errors';
import { METHOD_IDS, mockPaymentMethods } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { MethodList } from './method-list';

/**
 * The rail table is the screen an operator reads before deciding whether a deposit was even
 * possible, so what is tested here is the arithmetic they read off it — limits and fees — and the
 * two things that must never happen by accident: a deactivation without a confirmation, and a
 * read-only role finding a button it should not have.
 *
 * The first query in each case is a `findBy` because the router resolves its route asynchronously.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The toast module is mocked for the whole file, so its call log has to be emptied between cases.
beforeEach(() => {
  vi.clearAllMocks();
});

const bank = mockPaymentMethods[0]!;
const wallet = mockPaymentMethods[1]!;
const cash = mockPaymentMethods[2]!;

function renderList(
  overrides: Partial<Parameters<typeof MethodList>[0]> = {},
  options: Parameters<typeof renderWithProviders>[1] = {},
) {
  return renderWithProviders(
    <MethodList
      methods={mockPaymentMethods}
      isLoading={false}
      error={null}
      onRetry={vi.fn()}
      {...overrides}
    />,
    {
      route: '/payment-methods',
      routePath: '/payment-methods',
      validateSearch: (search) => paymentMethodSearchSchema.parse(search),
      ...options,
    },
  );
}

const selectButton = (code: string) =>
  screen.findByRole('button', { name: new RegExp(`^${code}`) });

const rowFor = async (code: string) => (await selectButton(code)).closest('tr')!;

describe('MethodList', () => {
  it('states each rail limits and fee exactly as the backend holds them', async () => {
    renderList();

    const walletRow = await rowFor('MOBILE_WALLET');
    expect(walletRow).toHaveTextContent('10,000.00 to 1,000,000.00');
    expect(walletRow).toHaveTextContent('500.00 + 1.50%');

    const bankRow = await rowFor('BANK_SYR');
    expect(bankRow).toHaveTextContent('50,000.00 to 5,000,000.00');
    // Zero fixed and zero basis points is a fact worth saying in words rather than as "0.00 + 0.00%".
    expect(bankRow).toHaveTextContent('No fee');
  });

  it('says in words whether a reference is required, and whether the rail is live', async () => {
    renderList();

    expect(within(await rowFor('BANK_SYR')).getByText('Required')).toBeInTheDocument();
    expect(within(await rowFor(cash.code)).getByText('Not required')).toBeInTheDocument();
    expect(within(await rowFor('BANK_SYR')).getByText('Active')).toBeInTheDocument();
    expect(within(await rowFor('OLD_CRYPTO')).getByText('Deactivated')).toBeInTheDocument();
  });

  it('names the verification mode', async () => {
    renderList();
    expect(within(await rowFor('MOBILE_WALLET')).getByText('Reference match')).toBeInTheDocument();
  });

  it('puts the chosen method in the URL so the view can be shared', async () => {
    const { user, location } = renderList();

    await user.click(await selectButton(bank.code));

    await waitFor(() => {
      expect(location()).toContain(`selected=${METHOD_IDS.bank}`);
    });
  });

  it('lets the same click take the selection back off', async () => {
    const { user, location } = renderList(
      {},
      { route: `/payment-methods?selected=${METHOD_IDS.bank}` },
    );

    await user.click(await selectButton(bank.code));

    await waitFor(() => {
      expect(location()).not.toContain('selected=');
    });
  });

  it('shows a skeleton while the rails load', async () => {
    renderList({ methods: undefined, isLoading: true });
    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument();
  });

  it('shows the failure and offers to retry', async () => {
    const onRetry = vi.fn();
    const { user } = renderList({
      methods: undefined,
      isLoading: false,
      error: new ApiError({ status: 500, code: 'INTERNAL', message: 'The rails did not load.' }),
      onRetry,
    });

    expect(await screen.findByText('The rails did not load.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers the first method when there are none at all', async () => {
    renderList({ methods: [] });
    expect(
      await screen.findByRole('button', { name: /add the first method/i }),
    ).toBeInTheDocument();
  });

  it('offers to clear the filters when they are what hid everything', async () => {
    const { user, location } = renderList(
      { methods: [] },
      { route: '/payment-methods?rail=CRYPTO' },
    );

    const clear = await screen.findByRole('button', { name: /show every rail/i });
    expect(screen.queryByRole('button', { name: /add the first method/i })).toBeNull();

    await user.click(clear);
    await waitFor(() => {
      expect(location()).not.toContain('rail=');
    });
  });

  it('filters by rail through the URL', async () => {
    const { user, location } = renderList(
      {},
      { route: `/payment-methods?selected=${METHOD_IDS.bank}` },
    );

    await user.click(await screen.findByRole('combobox', { name: 'Rail' }));
    await user.click(await screen.findByRole('option', { name: 'Crypto' }));

    await waitFor(() => {
      expect(location()).toContain('rail=CRYPTO');
    });
    // The selection goes with the filter that hid it, rather than pointing at nothing.
    expect(location()).not.toContain('selected=');
  });

  it('filters by state through the URL, inactive included', async () => {
    const { user, location } = renderList();

    await user.click(await screen.findByRole('combobox', { name: 'State' }));
    await user.click(await screen.findByRole('option', { name: 'Inactive only' }));

    await waitFor(() => {
      expect(location()).toContain('isActive=false');
    });
  });

  it('clears the filters from the toolbar too', async () => {
    const { user, location } = renderList({}, { route: '/payment-methods?rail=CRYPTO' });

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(location()).not.toContain('rail=');
    });
  });

  it('opens and closes the create form', async () => {
    const { user } = renderList();

    await user.click(await screen.findByRole('button', { name: /new method/i }));
    expect(await screen.findByRole('heading', { name: 'New payment method' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'New payment method' })).toBeNull();
    });
  });

  it('opens the create form from the empty state as well', async () => {
    const { user } = renderList({ methods: [] });

    await user.click(await screen.findByRole('button', { name: /add the first method/i }));

    expect(await screen.findByRole('heading', { name: 'New payment method' })).toBeInTheDocument();
  });

  it('selects the method it has just created', async () => {
    const { user, location } = renderList({ methods: [] });

    await user.click(await screen.findByRole('button', { name: /add the first method/i }));
    await user.type(await screen.findByLabelText('Code'), 'TEST_RAIL');
    await user.type(screen.getByLabelText('Display name'), 'Test rail');
    await user.type(screen.getByLabelText('Currency'), 'NSP');
    await user.type(screen.getByLabelText('Minimum amount'), '100.00');
    await user.type(screen.getByLabelText('Maximum amount'), '200000.00');
    await user.click(screen.getByRole('button', { name: /create method/i }));

    await waitFor(() => {
      expect(location()).toContain('selected=');
    });
  });

  it('lets a confirmation be backed out of', async () => {
    const { user } = renderList();

    await user.click(await screen.findByRole('button', { name: `Deactivate ${bank.displayName}` }));
    await screen.findByRole('heading', { name: `Deactivate ${bank.displayName}?` });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: `Deactivate ${bank.displayName}?` })).toBeNull();
    });
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('confirms before it deactivates, and says what stops happening', async () => {
    const { user } = renderList();

    await user.click(await screen.findByRole('button', { name: `Deactivate ${bank.displayName}` }));

    expect(
      await screen.findByRole('heading', { name: `Deactivate ${bank.displayName}?` }),
    ).toBeInTheDocument();
    expect(screen.getByText(/players will stop being offered this method/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is deleted/i)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        `${bank.displayName} deactivated`,
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
  });

  it('reports a deactivation the backend refused', async () => {
    const { user } = renderList();

    await user.click(
      await screen.findByRole('button', { name: `Deactivate ${wallet.displayName}` }),
    );
    await screen.findByRole('heading', { name: `Deactivate ${wallet.displayName}?` });

    server.use(
      http.delete(`${config.apiBaseUrl}/v1/admin/payment-methods/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'METHOD_IN_USE', message: 'Deposits are still in flight on this rail.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 409 },
        ),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        `Could not deactivate ${wallet.displayName}`,
        expect.objectContaining({ description: 'Deposits are still in flight on this rail.' }),
      );
    });
    // Still open: the operator asked for something that did not happen.
    expect(
      screen.getByRole('heading', { name: `Deactivate ${wallet.displayName}?` }),
    ).toBeInTheDocument();
  });

  it('does not offer to deactivate what is already deactivated', async () => {
    renderList();
    expect(
      await screen.findByRole('button', { name: 'Edit Crypto (retired)' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate Crypto (retired)' })).toBeNull();
  });

  it('opens the edit form on the method that was clicked', async () => {
    const { user } = renderList();

    await user.click(await screen.findByRole('button', { name: `Edit ${wallet.displayName}` }));

    expect(
      await screen.findByRole('heading', { name: `Edit ${wallet.displayName}` }),
    ).toBeInTheDocument();
  });

  it('shows a REVIEWER every rail and no way to change one', async () => {
    renderList({}, { auth: { role: 'REVIEWER' } });

    expect(await selectButton(bank.code)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new method/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Deactivate / })).toBeNull();
  });

  it('shows SUPPORT the same read-only screen', async () => {
    renderList({}, { auth: { role: 'SUPPORT' } });

    expect(await selectButton(wallet.code)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new method/i })).toBeNull();
  });
});
