import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Locale } from '@/lib/i18n/locales';
import { resetMockAccount } from '@/mocks/shamcash-dev';
import type { AdminRole } from '@/types/enums';
import { renderWithProviders } from '@/test/utils';

import { ShamCashAccountPage } from './shamcash-account-page';

/**
 * YOUR SHAM CASH ACCOUNT — one button, then the account.
 *
 * ══ WHAT THESE TESTS ARE REALLY GUARDING ═════════════════════════════════════════════════════
 * This screen replaced one that asked for five values copied out of browser developer tools. Three
 * properties make the replacement worth having, and each fails silently if it regresses:
 *
 *   NO CREDENTIAL FIELDS.  Not one input for a token, a cookie or a hash. Their return would be the
 *                          regression, so their ABSENCE is asserted rather than assumed.
 *   NO POLLING.            The figures are read when asked for. A timer here would drive a real
 *                          browser at a third party forever, for numbers that change when a person
 *                          does something rather than on a clock.
 *   NEVER UNQUALIFIED.     Every figure is a cached read, so the age is always on screen. A balance
 *                          shown without one is a claim about NOW, and somebody will act on it.
 */

const renderPage = (role: AdminRole = 'PLATFORM_ADMIN', locale: Locale = 'en') =>
  renderWithProviders(<ShamCashAccountPage />, {
    auth: { role },
    locale,
    route: '/dev/shamcash',
    routePath: '/dev/shamcash',
  });

/** Links the account the way a person does: choose a PIN, show the code, wait for the scan. */
const link = async (user: ReturnType<typeof renderPage>['user'], pin = '2468') => {
  await user.type(await screen.findByLabelText(/PIN to set on this browser/i), pin);
  await user.click(screen.getByRole('button', { name: /show me a code/i }));
  await screen.findByText('Linked', {}, { timeout: 10_000 });
  // The pairing reporting 'Linked' and the console having re-read the status are two things. The
  // Refresh button belongs to the second, so waiting on the first alone is a race.
  await screen.findByRole('heading', { name: 'Account' });
};

beforeEach(() => {
  // Module state on the mock, so one spec's linked account is not the next one's starting point.
  resetMockAccount();
});

describe('before anything is linked', () => {
  it('offers a code to scan and nothing else to think about', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /show me a code/i })).toBeInTheDocument();
    expect(await screen.findByText(/no account is linked yet/i)).toBeInTheDocument();
  });

  it('asks for NO tokens, cookies or hashes — that is the point of the rewrite', async () => {
    // THE REGRESSION THIS GUARDS. The screen this replaced asked for accessToken, authToken, forge
    // and a localStorage hash, where one mistyped character produced a 90-second failure that looked
    // exactly like an expired session.
    renderPage();

    await screen.findByRole('button', { name: /show me a code/i });

    expect(screen.queryByLabelText(/accessToken/i)).toBeNull();
    expect(screen.queryByLabelText(/authToken/i)).toBeNull();
    expect(screen.queryByLabelText(/forge/i)).toBeNull();
    expect(screen.queryByLabelText(/shamcash-pin-code-hash/i)).toBeNull();
  });
});

describe('linking', () => {
  it('turns into the account once the phone approves', async () => {
    const { user } = renderPage();

    await link(user);

    // The QR folds away and the screen becomes "your account" rather than staying a setup wizard.
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show me a code/i })).toBeNull();
  });

  it('says the account has not been read yet, rather than showing a zero', async () => {
    // A linked session and no read are different from an empty account, and conflating them would
    // tell somebody their money is gone.
    const { user } = renderPage();

    await link(user);

    // Said twice on purpose: once as the card's subtitle, once where the figures would be.
    expect(await screen.findAllByText(/not read yet/i)).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});

describe('reading the account', () => {
  it('reads the balances on request, and says WHEN it read them', async () => {
    const { user } = renderPage();
    await link(user);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(await screen.findByText('250,000')).toBeInTheDocument();
    expect(screen.getByText('SYP')).toBeInTheDocument();
    // The qualifier that makes the rest of the card honest.
    expect(screen.getByText(/^Read$/)).toBeInTheDocument();
  });

  it('does not read anything until it is asked to', async () => {
    // No timer, and no read on mount: a refresh drives a real browser on the API side.
    const { user } = renderPage();
    await link(user);

    expect(screen.queryByText('250,000')).toBeNull();
  });

  it('keeps the figures on screen after the account is unlinked… by removing them deliberately', async () => {
    const { user } = renderPage();
    await link(user);
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await screen.findByText('250,000');

    await user.click(screen.getByRole('button', { name: /unlink/i }));

    // Unlink is an explicit sign-out, so it clears — unlike a session that simply closed, which
    // keeps its last numbers with a warning that they will not update.
    expect(await screen.findByText(/no account is linked yet/i)).toBeInTheDocument();
  });
});

describe('the parser diagnostic', () => {
  it('is still here, because it answers what the account view cannot', async () => {
    // "Did the page change?" versus "was the session refused?" — identical from outside, completely
    // different fixes. It found the Create PIN screen, the Confirm PIN step and the invisible QR.
    renderPage();

    expect(await screen.findByLabelText(/page text/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parse it/i })).toBeInTheDocument();
  });

  it('says plainly when it recognised nothing, which is the redesign signal', async () => {
    const { user } = renderPage();

    await user.type(await screen.findByLabelText(/page text/i), 'Some other page entirely');
    await user.click(screen.getByRole('button', { name: /parse it/i }));

    expect(await screen.findByText('The parser found nothing')).toBeInTheDocument();
  });
});

describe('in Arabic', () => {
  it('translates the screen, both halves of it', async () => {
    renderPage('PLATFORM_ADMIN', 'ar');

    expect(await screen.findByRole('heading', { name: 'حسابك في شام كاش' })).toBeInTheDocument();
    // Awaited, because the QR half only renders once the status query has said nothing is linked —
    // the page header paints before that and would make this assertion a race.
    expect(await screen.findByText('لا يوجد حساب مربوط بعد')).toBeInTheDocument();
    expect(screen.getByText('الربط عبر رمز QR')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
