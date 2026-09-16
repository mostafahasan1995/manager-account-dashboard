import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockDestinations } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { PaymentDestination } from '@/types';

import { DeclaredBalanceDialog } from './declared-balance-dialog';

/**
 * The hand-typed balance is bookkeeping, not money that moves — but it is still the number an
 * operator reads when deciding whether an account can cover a payout, so the two things that would
 * quietly corrupt it are what these tests pin: a half-set balance (an amount with no currency), and
 * a save that sends something other than what was typed.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const base = mockDestinations[0]!;

const unset: PaymentDestination = {
  ...base,
  id: 'dddddddd-0000-4000-8000-000000000901',
  declaredBalance: null,
  declaredBalanceMinor: null,
  declaredBalanceCurrency: null,
  declaredBalanceUpdatedAt: null,
  declaredBalanceSetByAdminId: null,
};

const set: PaymentDestination = {
  ...unset,
  label: 'Damascus office',
  declaredBalance: '200.00',
  declaredBalanceMinor: '20000',
  declaredBalanceCurrency: 'USD',
  declaredBalanceUpdatedAt: '2026-08-01T00:00:00.000Z',
  declaredBalanceSetByAdminId: 'admin-1',
};

const render = (destination: PaymentDestination) =>
  renderPlain(<DeclaredBalanceDialog open onOpenChange={vi.fn()} destination={destination} />);

/** Captures the PATCH body so a test can assert what was actually sent, not merely that it saved. */
function captureSave(): { body: () => unknown } {
  let captured: unknown = null;
  server.use(
    http.patch(
      `${config.apiBaseUrl}/v1/admin/payment-destinations/:id/declared-balance`,
      async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: set,
            error: null,
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 200 },
        );
      },
    ),
  );
  return { body: () => captured };
}

describe('the recorded-balance dialog', () => {
  it('opens on whatever the account already has', () => {
    render(set);

    expect(screen.getByLabelText('Amount')).toHaveValue('200.00');
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
  });

  it('refuses an amount with no currency — a half-set balance is not a balance', async () => {
    const save = captureSave();
    const { user } = render(unset);

    await user.type(screen.getByLabelText('Amount'), '200');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/leave both empty/i)).toBeInTheDocument();
    expect(save.body()).toBeNull();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('refuses a negative balance', async () => {
    const { user } = render(unset);

    await user.type(screen.getByLabelText('Amount'), '-5');
    await user.type(screen.getByLabelText('Currency'), 'USD');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/cannot be negative/i)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('sends the amount and the currency upper-cased', async () => {
    const save = captureSave();
    const { user } = render(unset);

    await user.type(screen.getByLabelText('Amount'), '300');
    await user.type(screen.getByLabelText('Currency'), 'usd');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(save.body()).not.toBeNull();
    });
    const body = save.body() as { balance: string; currency: string };
    expect(body.currency).toBe('USD');
    expect(body.balance).toMatch(/^300/);
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });

  it('clears the balance when both fields are emptied', async () => {
    // The only way to remove a recorded balance, and it must send an explicit null pair rather than
    // an empty string the backend would reject.
    const save = captureSave();
    const { user } = render(set);

    await user.clear(screen.getByLabelText('Amount'));
    await user.clear(screen.getByLabelText('Currency'));
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(save.body()).not.toBeNull();
    });
    expect(save.body()).toEqual({ balance: null, currency: null });
  });
});
