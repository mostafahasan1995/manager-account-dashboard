/**
 * THE SHAM CASH API KEY, AND THE ONE PROPERTY THAT MATTERS.
 *
 * Whoever holds this key is signed in as the operator's cashier account. The backend seals it and no
 * endpoint returns it, so the console can never show it back — and the tests below assert that from
 * the outside: the field is empty even when a key is saved, and nothing on screen carries the value
 * that was typed.
 *
 * The wallet id is the opposite case and is asserted as such: it is a path segment, not a
 * credential, and an operator has to be able to read back what was saved to check it.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, resetMockDb } from '@/mocks/db';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { ShamCashApiCard } from './shamcash-api-card';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));

const WALLET = '4c326c62cd11f1a72e10bbc9c41e90c8';
const KEY = 'sk-live-abc12345';

const render = (role: AdminRole = 'SUPER_ADMIN') =>
  renderWithProviders(<ShamCashApiCard />, {
    route: '/financial',
    routePath: '/financial',
    auth: { role },
  });

beforeEach(() => {
  resetMockDb();
  vi.clearAllMocks();
});

describe('with no key yet', () => {
  it('says so, and explains why the key is worth adding', async () => {
    render();

    expect(await screen.findByText('No key')).toBeInTheDocument();
    expect(screen.getByText('Sham Cash deposits need this key')).toBeInTheDocument();
  });

  it('saves a wallet id and key together', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add the key' }));
    await user.type(screen.getByLabelText('Wallet ID'), WALLET);
    await user.type(screen.getByLabelText('API key'), KEY);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Key saved')).toBeInTheDocument();
    });
    expect(db.shamCashSession.walletId).toBe(WALLET);
  });

  it('will not save half of a pair', async () => {
    // A key with no wallet id has no URL to call; a wallet id with no key gets rejected. The
    // database refuses the pair, so the form must not offer to send one.
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add the key' }));
    await user.type(screen.getByLabelText('Wallet ID'), WALLET);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('masks the key as it is typed', async () => {
    // It is read off a screen in an office, and it is the one value here that must not be
    // shoulder-surfed or captured in a screen share.
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add the key' }));

    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
  });
});

describe('with a key saved', () => {
  beforeEach(() => {
    db.shamCashSession = { apiLinked: true, walletId: WALLET };
  });

  it('NEVER shows the key back, not even in a masked field', async () => {
    // THE ONE THAT MATTERS. Nothing in the console can read it — the backend does not return it —
    // so an empty field is the honest rendering, and the badge is what says a key exists.
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Replace the key' }));

    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(document.body.textContent).not.toContain(KEY);
  });

  it('DOES show the wallet id back, because it is not a credential', async () => {
    // An operator has to be able to check what was saved against their Sham Cash dashboard.
    const user = userEvent.setup();
    render();

    expect(await screen.findByText(`Wallet ${WALLET}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Replace the key' }));
    expect(screen.getByLabelText('Wallet ID')).toHaveValue(WALLET);
  });

  it('says the existing key cannot be shown, rather than looking like an empty setting', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Replace the key' }));

    expect(screen.getByText(/already saved and cannot be shown/i)).toBeInTheDocument();
  });

  it('removes both halves on unlink', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.getByText('No key')).toBeInTheDocument();
    });
    expect(db.shamCashSession.apiLinked).toBe(false);
    expect(db.shamCashSession.walletId).toBeNull();
  });
});

describe('who may change it', () => {
  it('offers a role without the rails permission nothing that writes', async () => {
    // Hiding is not the boundary — the server is — but a control that always 403s is a lie about
    // what this person can do.
    render('SUPPORT');

    expect(await screen.findByText('No key')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add the key' })).not.toBeInTheDocument();
  });
});

describe('testing the key against the live API', () => {
  beforeEach(() => {
    db.shamCashSession = { apiLinked: true, walletId: WALLET };
  });

  it('is offered only once a key exists', async () => {
    // There is nothing to test before one is saved, and a button that can only fail is noise.
    resetMockDb();
    render();

    expect(await screen.findByText('No key')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test the key' })).not.toBeInTheDocument();
  });

  it('shows the balance AND the transactions, because they can fail apart', async () => {
    // A key that reads the balance is not proof that lookups work — and lookups are what /checkpay
    // depends on. One combined verdict would hide that split.
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Test the key' }));

    expect(await screen.findByText('Balance right now')).toBeInTheDocument();
    expect(screen.getByText(/250000 SYP/)).toBeInTheDocument();
    expect(screen.getByText('Latest transactions')).toBeInTheDocument();
  });

  it('marks an incoming operation apart from an outgoing one', async () => {
    // A debit is money the operator SENT. Reading it as a receipt is the expensive misreading here,
    // so the sign is on screen rather than left to the amount alone.
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Test the key' }));

    expect(await screen.findByText(/\+1200 SYP/)).toBeInTheDocument();
    expect(screen.getByText(/−1100 SYP/)).toBeInTheDocument();
  });

  it('does not fire on render — only when asked', async () => {
    // It hits a third party. A test that ran on mount would bill the vendor for every page view.
    render();

    await screen.findByText('Key saved');
    expect(screen.queryByText('Balance right now')).not.toBeInTheDocument();
  });
});
