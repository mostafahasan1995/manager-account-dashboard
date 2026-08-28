import { screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/mocks/db';
import { renderWithProviders } from '@/test/utils';

import { ShamCashCard } from './shamcash-card';

/**
 * Linking a Sham Cash account is pasting a session, not a payment rail. The cases that matter: a
 * half-pasted session (a token missing) must not be accepted; a reader must see the status but not
 * the form; and once linked, the cookies are never shown back — the card can only say "linked".
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const render = (role: 'SUPER_ADMIN' | 'SUPPORT' = 'SUPER_ADMIN') =>
  renderWithProviders(<ShamCashCard />, { auth: { role } });

describe('when nothing is linked', () => {
  it('shows the not-linked state and the cookie form to a manager', async () => {
    render();

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(screen.getByLabelText('accessToken cookie')).toBeInTheDocument();
    expect(screen.getByLabelText('authToken cookie')).toBeInTheDocument();
  });

  it('will not link with a token missing', async () => {
    const { user } = render();

    await user.type(await screen.findByLabelText('accessToken cookie'), 'ACCESS-only');
    await user.click(screen.getByRole('button', { name: /link account/i }));

    expect(await screen.findByText(/paste the authToken/i)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('links once the tokens and pin hash are pasted, and never shows them back', async () => {
    const { user } = render();

    await user.type(await screen.findByLabelText('accessToken cookie'), 'ACCESS-abc');
    await user.type(screen.getByLabelText('authToken cookie'), 'jwt.header.payload');
    await user.type(screen.getByLabelText('shamcash-pin-code-hash'), 'pin-hash-abc');
    await user.type(screen.getByLabelText('PIN code'), '1234');
    await user.click(screen.getByRole('button', { name: /link account/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
    });
    // The status flips to linked; the pasted values are never rendered anywhere.
    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(screen.queryByText('jwt.header.payload')).toBeNull();
  });
});

describe('when a session is already linked', () => {
  beforeEach(() => {
    db.shamCashSession = { linked: true, updatedAt: new Date().toISOString() };
  });

  it('shows the linked state and an unlink control', async () => {
    render();

    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlink/i })).toBeInTheDocument();
  });

  it('reads the balance on demand and shows the wallets and transfers', async () => {
    const { user } = render();

    await user.click(await screen.findByRole('button', { name: /check balance/i }));

    // The SYP available figure and a recent transfer, read from the (mocked) session replay.
    expect(await screen.findByText('250,000')).toBeInTheDocument();
    expect(screen.getByText('Recent transfers')).toBeInTheDocument();
    expect(screen.getByText('Counterparty One')).toBeInTheDocument();
  });
});

describe('a read-only role', () => {
  it('sees the status but not the form', async () => {
    // SUPPORT can read payment config but not change it — so it sees whether an account is linked,
    // and no way to paste a session.
    render('SUPPORT');

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(screen.queryByLabelText('accessToken cookie')).toBeNull();
    expect(screen.queryByRole('button', { name: /link account/i })).toBeNull();
  });
});
