import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { db } from '@/mocks/db';
import { METHOD_IDS, mockPaymentMethods } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';
import type { PaymentDestination, PaymentMethod } from '@/types';

import { FinancialPage } from './financial-page';

/**
 * The screen an operator was looking for, then could not use.
 *
 * Two reported bugs live in these cases. The first is that the page keyed everything off the method
 * CODE, so an operator whose rails are called `USDT` and `SHAM` — because they typed those names —
 * saw an empty screen and no address validation. The second is what they asked for once it worked:
 * every method, the account each pays into, and somewhere to edit it. Each test below is one way
 * the old screen lied or fell short.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const render = (options: Parameters<typeof renderWithProviders>[1] = {}) =>
  renderWithProviders(<FinancialPage />, {
    route: '/financial',
    routePath: '/financial',
    ...options,
  });

const PLACEHOLDER_TRC20 = 'SEED-PLACEHOLDER-USDT-TRC20-0000';

/** A wallet the operator actually owns, added beside the placeholder the backend seeded. */
const realTrc20Address: PaymentDestination = {
  id: 'dddddddd-0000-4000-8000-000000000101',
  paymentMethodId: METHOD_IDS.usdtTrc20,
  label: 'Operator TRC20 wallet',
  accountIdentifier: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  accountHolder: 'Cashier Holdings LLC',
  notes: null,
  isActive: true,
  priority: 1,
  dailyCap: null,
  declaredBalance: null,
  declaredBalanceMinor: null,
  declaredBalanceCurrency: null,
  declaredBalanceUpdatedAt: null,
  declaredBalanceSetByAdminId: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

/** Every field a method carries, so the drift detector sees the same shape the API sends. */
const methodLike = (
  over: Partial<PaymentMethod> & Pick<PaymentMethod, 'id' | 'code'>,
): PaymentMethod => ({
  ...mockPaymentMethods[0]!,
  displayName: over.code,
  isActive: true,
  ...over,
});

const destinationLike = (
  over: Partial<PaymentDestination> &
    Pick<PaymentDestination, 'id' | 'paymentMethodId' | 'label' | 'accountIdentifier'>,
): PaymentDestination => ({
  accountHolder: null,
  notes: null,
  isActive: true,
  priority: 1,
  dailyCap: null,
  declaredBalance: null,
  declaredBalanceMinor: null,
  declaredBalanceCurrency: null,
  declaredBalanceUpdatedAt: null,
  declaredBalanceSetByAdminId: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

/**
 * The operator's two real methods, exactly as they created them through this console: a code they
 * typed, not one the seeder wrote. `USDT` is the rail that used to vanish from this page entirely.
 */
const OPERATOR_USDT = 'cccccccc-0000-4000-8000-000000000011';
const OPERATOR_SHAM = 'cccccccc-0000-4000-8000-000000000012';

function addOperatorMethods() {
  db.methods.push(
    methodLike({ id: OPERATOR_USDT, code: 'USDT', displayName: 'usdt trc20', rail: 'CRYPTO' }),
    methodLike({
      id: OPERATOR_SHAM,
      code: 'SHAM',
      displayName: 'sham cash dollar',
      rail: 'CASH_OFFICE',
    }),
  );
  db.destinations.push(
    destinationLike({
      id: 'dddddddd-0000-4000-8000-000000000201',
      paymentMethodId: OPERATOR_USDT,
      label: 'Main USDT wallet',
      accountIdentifier: 'TXyZ8kLmNpQrStUvWxYz23456789abcdef',
    }),
    destinationLike({
      id: 'dddddddd-0000-4000-8000-000000000202',
      paymentMethodId: OPERATOR_SHAM,
      label: 'Damascus office',
      accountIdentifier: 'SHAM-DAM-0091',
      accountHolder: 'Cashier Holdings LLC',
    }),
  );
}

/** One method's card. Each is a landmark named after the method, so this is how a reader finds it. */
const cardFor = (displayName: string): Promise<HTMLElement> =>
  screen.findByRole('region', { name: displayName });

describe('FinancialPage', () => {
  it('lists every payment method, not only the ones this system seeded', async () => {
    addOperatorMethods();
    render();

    // The operator's own rails, which the code-keyed screen showed neither of.
    expect(await cardFor('usdt trc20')).toBeInTheDocument();
    expect(await cardFor('sham cash dollar')).toBeInTheDocument();
    // And every other method, including the rails that are not crypto at all.
    expect(await cardFor('Bank transfer')).toBeInTheDocument();
    expect(await cardFor('Mobile wallet')).toBeInTheDocument();
    expect(await cardFor('Cash office')).toBeInTheDocument();
    expect(await cardFor('USDT — TRC20 (Tron)')).toBeInTheDocument();
  });

  /**
   * Bug 1, stated as behaviour. `USDT` is not in any table of codes this system knows, and it never
   * needs to be: the RAIL says the method pays on a chain and the ADDRESS says which one.
   */
  it("treats an operator's own USDT method as a chain rail, reading the chain off the address", async () => {
    addOperatorMethods();
    render();

    const card = await cardFor('usdt trc20');

    expect(await within(card).findByText('Main USDT wallet')).toBeInTheDocument();
    // TRC20 because the address starts `T…`, not because anything believed the method's name.
    expect(within(card).getByText('TRC20')).toBeInTheDocument();
    expect(await within(card).findByTestId('wallet-balance')).toBeInTheDocument();
  });

  it('gives a cash method its account and no balance, because no chain can answer for it', async () => {
    addOperatorMethods();
    render();

    const card = await cardFor('sham cash dollar');

    expect(await within(card).findByText('Damascus office')).toBeInTheDocument();
    expect(within(card).getByText('SHAM-DAM-0091')).toBeInTheDocument();
    // Not a zero and not a blank: a figure nobody can read must never be rendered as one that was.
    expect(
      within(card).getByText('No balance is tracked for this account yet.'),
    ).toBeInTheDocument();
    expect(within(card).queryByTestId('wallet-balance')).toBeNull();
  });

  it('shows a recorded balance with its currency and how recently it was set', async () => {
    // The figure a human typed for a rail no chain can answer for. It always carries WHEN, because
    // a recorded balance with no date is a number of unknown age dressed up as a current one.
    addOperatorMethods();
    db.destinations.push(
      destinationLike({
        id: 'dddddddd-0000-4000-8000-000000000203',
        paymentMethodId: OPERATOR_SHAM,
        label: 'Aleppo office',
        accountIdentifier: 'SHAM-ALP-0002',
        declaredBalance: '2000000.00',
        declaredBalanceMinor: '200000000',
        declaredBalanceCurrency: 'NSP',
        declaredBalanceUpdatedAt: '2026-08-27T00:00:00.000Z',
      }),
    );
    render();

    const card = await cardFor('sham cash dollar');

    expect(await within(card).findByText('2000000.00')).toBeInTheDocument();
    expect(within(card).getByText('NSP')).toBeInTheDocument();
    expect(within(card).getByText(/updated/i)).toBeInTheDocument();
  });

  it('offers a manager an Add balance control on an account that has none', async () => {
    addOperatorMethods();
    render();

    const card = await cardFor('sham cash dollar');

    expect(await within(card).findByRole('button', { name: /add balance/i })).toBeInTheDocument();
  });

  /**
   * The house rule, pinned from the side nobody was watching: crypto-ness comes from the RAIL, and
   * the address is only ever asked WHICH chain. Detecting on the address alone would read this
   * office reference as BEP20, badge a Damascus cashier with a chain, and put a live balance query
   * on a destination no chain has ever heard of — whose inevitable miss renders as an outage
   * warning about money that was never on a chain to begin with.
   */
  it('asks no chain about a cash account, even one whose number reads like an address', async () => {
    const officeId = 'cccccccc-0000-4000-8000-000000000013';
    db.methods.push(
      methodLike({
        id: officeId,
        code: 'SHAM_HEX',
        displayName: 'sham cash hex-numbered',
        rail: 'CASH_OFFICE',
      }),
    );
    db.destinations.push(
      destinationLike({
        id: 'dddddddd-0000-4000-8000-000000000203',
        paymentMethodId: officeId,
        label: 'Aleppo office',
        accountIdentifier: '0x55d398326f99059fF775485246999027B3197955',
      }),
    );
    render();

    const card = await cardFor('sham cash hex-numbered');

    expect(await within(card).findByText('Aleppo office')).toBeInTheDocument();
    expect(within(card).queryByText('BEP20')).toBeNull();
    expect(within(card).queryByTestId('wallet-balance')).toBeNull();
    expect(
      within(card).getByText('No balance is tracked for this account yet.'),
    ).toBeInTheDocument();
  });

  it('treats the seeded placeholder as no address at all', async () => {
    render();

    // Scoped to one card: the page carries a dozen now, and a count across all of them would pass
    // for the wrong reason the moment a method is added to the fixtures.
    const card = await cardFor('USDT — TRC20 (Tron)');

    expect(await within(card).findByText('No wallet address yet')).toBeInTheDocument();
    expect(within(card).getByText('This rail is not ready to take money')).toBeInTheDocument();
    // The whole bug in one assertion: the placeholder must never be presented as an address.
    expect(within(card).queryByText(PLACEHOLDER_TRC20)).toBeNull();
    expect(screen.queryByText(PLACEHOLDER_TRC20)).toBeNull();
  });

  it('warns that the placeholder is still taking deposits after a real address is added', async () => {
    db.destinations.push({ ...realTrc20Address });
    render();

    expect(await screen.findByText('Operator TRC20 wallet')).toBeInTheDocument();
    // Adding an address does not retire the placeholder: it is still active, still priority 0, and
    // therefore still handed to players at least as often as the address just entered.
    expect(screen.getByText('Players are still being sent to the placeholder')).toBeInTheDocument();
  });

  /**
   * The wiring, not the component: `wallet-balance.test.tsx` already proves every state of the
   * card. What is pinned here is that the card is on the SCREEN — it was built and left orphaned,
   * and an orphaned component is invisible to its own passing tests.
   */
  it('shows what the wallet holds beside the address it belongs to', async () => {
    db.destinations.push({ ...realTrc20Address });
    render();

    const address = await screen.findByText('Operator TRC20 wallet');
    const balance = await screen.findByTestId('wallet-balance');
    // Beside THIS address: with several rails and a balance each, a card rendered anywhere else on
    // the screen would leave the operator guessing which wallet the figure belongs to.
    expect(address.closest('li')).toContainElement(balance);
    expect(await screen.findByTestId('money')).toHaveTextContent('1,088.486000 USDT');
  });

  /**
   * The operator's actual request — "each payment should we can edit". It opens the SAME dialog the
   * rails screen uses, which is what keeps the account identifier locked on edit; a second address
   * form here would be a second place for that rule to be missing.
   */
  it('edits an account through the existing dialog, with the identifier still locked', async () => {
    addOperatorMethods();
    const { user } = render();

    const card = await cardFor('sham cash dollar');
    await user.click(await within(card).findByRole('button', { name: 'Edit Damascus office' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/silently redirect players/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /account identifier/i })).toBeNull();
  });

  it('asks before it stops the placeholder, then stops it', async () => {
    db.destinations.push({ ...realTrc20Address });
    const { user } = render();

    await user.click(
      await screen.findByRole('button', { name: /stop sending players to the placeholder/i }),
    );

    // Every deactivation on this screen asks first, and the dialog names the account it will stop.
    expect(await screen.findByText(PLACEHOLDER_TRC20)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(screen.queryByText('Players are still being sent to the placeholder')).toBeNull();
    });
    expect(screen.getByText('Operator TRC20 wallet')).toBeInTheDocument();
  });

  it('offers the activation step, without which the operator sees nothing change in the bot', async () => {
    db.destinations.push({ ...realTrc20Address });
    const { user } = render();

    // The rail is seeded inactive — a rail that cannot be priced must not be on the menu — so an
    // address on its own changes nothing a player can see.
    await user.click(await screen.findByRole('button', { name: /activate this rail/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /activate this rail/i })).toBeNull();
    });
  });

  it('carries the rate form, which now lives here and nowhere else', async () => {
    render();
    expect(await screen.findByText('USDT rate')).toBeInTheDocument();
  });

  it('says so when the operator has no payment method at all', async () => {
    db.methods = [];
    render();

    expect(await screen.findByText('This operator has no payment method')).toBeInTheDocument();
  });

  /**
   * A retired rail — inactive AND with history — used to open this page next to the ones an
   * operator can still use, indistinguishable at a glance. `OLD_CRYPTO` is the fixture for it:
   * inactive, and marked `deletable: false` because something depends on it, same as a rail that
   * actually took deposits.
   */
  describe('a retired method', () => {
    it('is not on the screen by default', async () => {
      render();

      await cardFor('Bank transfer');
      expect(screen.queryByRole('region', { name: 'Crypto (retired)' })).toBeNull();
    });

    it('is one press away, named by count, and folds back on a second press', async () => {
      const { user } = render();
      await cardFor('Bank transfer');

      await user.click(await screen.findByRole('button', { name: 'Show 1 retired method' }));
      expect(await cardFor('Crypto (retired)')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Hide retired methods' }));
      await waitFor(() => {
        expect(screen.queryByRole('region', { name: 'Crypto (retired)' })).toBeNull();
      });
    });

    it('is what the empty state names when every method the operator has is retired', async () => {
      db.methods = db.methods.filter((method) => method.id === METHOD_IDS.retired);
      render();

      expect(await screen.findByText('Every method here is retired')).toBeInTheDocument();
      // Still reachable — the state is "nothing shown", not "nothing exists".
      await screen.findByRole('button', { name: 'Show 1 retired method' });
    });
  });

  /**
   * The other reason a method is inactive: it was seeded and never finished. `USDT_TRC20` is that
   * fixture verbatim — inactive, `deletable: true`, no history — and it is the rail this whole page
   * exists to let an operator finish setting up. Hiding it behind the same toggle as a retired rail
   * would hide the one screen that completes it.
   */
  it('shows an unconfigured-but-inactive rail without the operator asking for it', async () => {
    render();

    expect(await cardFor('USDT — TRC20 (Tron)')).toBeInTheDocument();
    // And it does not count toward "retired", so the toggle button does not even appear for it
    // alone — the fixtures also carry OLD_CRYPTO, so this only proves the count is not off by one.
    expect(screen.getByRole('button', { name: /retired method/i })).toHaveTextContent('1');
  });

  /**
   * SUPPORT, not VIEWER: VIEWER cannot read payment methods at all and would never reach this
   * route. SUPPORT holds `paymentMethods.read` and not `paymentMethods.write`, which is the case
   * the read-gated route exists for — it reads the rate while deciding a crypto deposit, and must
   * not be able to change a wallet address while doing it.
   */
  it('gives a read-only role the whole screen and none of the write controls', async () => {
    addOperatorMethods();
    db.destinations.push({ ...realTrc20Address });
    render({ auth: { role: 'SUPPORT' } });

    expect(await screen.findByText('Operator TRC20 wallet')).toBeInTheDocument();
    expect(screen.getByText('Damascus office')).toBeInTheDocument();
    expect(screen.getByText('Players are still being sent to the placeholder')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /^edit /i })).toBeNull();
    expect(screen.queryByRole('button', { name: /enter the wallet address/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /enter the account/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /add another address/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /add another account/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /stop sending players/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /activate this rail/i })).toBeNull();
    // The recorded-balance controls are write actions too — a reader sees the figure, not the pencil.
    expect(screen.queryByRole('button', { name: /^add balance$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.getByText('Your role can see this rate but not change it.')).toBeInTheDocument();
  });
});

/**
 * Arabic is not a skin: a Syrian cashier reads this screen in Arabic, and the sentence that has to
 * land hardest — the placeholder is not a wallet — is the one that would hurt most to leave in
 * English.
 */
describe('FinancialPage in Arabic', () => {
  it('names the screen and the placeholder danger in Arabic', async () => {
    render({ locale: 'ar' });

    expect(await screen.findByRole('heading', { name: 'الإعدادات المالية' })).toBeInTheDocument();

    const card = await cardFor('USDT — TRC20 (Tron)');
    expect(
      await within(card).findByText('هذه القناة غير جاهزة لاستقبال الأموال'),
    ).toBeInTheDocument();
    expect(within(card).getByText('لا يوجد عنوان محفظة بعد')).toBeInTheDocument();
  });
});
