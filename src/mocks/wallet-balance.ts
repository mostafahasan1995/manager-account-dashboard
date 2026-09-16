import { formatMinorToDecimal, minorFromString } from '@/lib/money';
import { USDT_SCALE, type ChainNetwork, type WalletBalance } from '@/types';

/**
 * What the chain says a payout wallet holds — in demo mode, and in every test that does not
 * override it.
 *
 * ══ WHY THE MOCK HAS TO BE ABLE TO FAIL ═══════════════════════════════════════════════════════
 * A mock where every balance reads would let the one rule this whole feature exists for rot
 * unnoticed: a balance that could not be read must never render as `0`. Zero is a real answer — an
 * empty wallet — and an outage shown as "0.00 USDT" is the most alarming false statement this
 * screen can make to somebody with money in that wallet.
 *
 * So two things here answer with no number at all, and both are states a real operator meets:
 *
 *   1. **A placeholder account.** Every freshly provisioned operator's destinations carry
 *      `SEED-PLACEHOLDER-…` rather than a wallet (see docs/TASKS.md CC-018). There is nothing
 *      on-chain to read, and saying so is the point: a rail in that state has been telling players
 *      to pay into a string that is not an address.
 *   2. **A well-formed wallet whose node is down** — `UNREADABLE_WALLET_ADDRESS`. This is the case
 *      that cannot be inferred from anything on screen, and the one an operator has to be able to
 *      tell apart from an empty wallet at a glance.
 *
 * Anything else answers a stable, plausible figure derived from the address, so a demo looks the
 * same on every reload and a test can assert an exact number.
 */

/** Tron: base58 without `0`, `O`, `I` or `l`, 34 characters. Mirrors the backend's own check. */
const TRC20_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

/** BNB Smart Chain: twenty bytes of hex behind `0x`. */
const BEP20_ADDRESS = /^0x[A-Fa-f0-9]{40}$/;

/**
 * A perfectly well-formed TRON wallet whose balance never reads.
 *
 * Exported so a fixture that wants the unavailable state on a USDT rail can simply use it as the
 * destination's `accountIdentifier`. Synthetic on purpose: it passes the shape check and belongs to
 * nobody.
 */
export const UNREADABLE_WALLET_ADDRESS = 'TDemoUnreadab1eWa22et999999999999x';

/** The human name of each chain, for the sentence a failed read comes back with. */
const CHAIN_NAMES: Readonly<Record<ChainNetwork, string>> = {
  TRC20: 'TRON',
  BEP20: 'BNB Smart Chain',
};

/**
 * The chain a string belongs to, read off the STRING and nothing else.
 *
 * This used to be reachable only through a `mockChainNetwork(methodCode, address)` that consulted a
 * `USDT_TRC20`/`USDT_BEP20` table FIRST and fell through to the address only for codes it did not
 * recognise. That is the shape of the bug this whole rail was rebuilt to undo, kept alive in the one
 * place nobody audits: the operator's live rail is coded plain `USDT`, so the table answered for
 * nobody real, while for the two seeded codes it overrode the address outright — a mock that
 * disagreed with its own server, since `DestinationBalanceService.read()` takes an address and is
 * never told the method at all.
 *
 * It matters more here than in a fixture. Demo mode and the Playwright suite have no backend: in two
 * of the three places this console runs, THIS is the server, and a mock that keyed on a code would
 * have gone on agreeing with the bug instead of catching it.
 */
export function mockNetworkForAddress(address: string): ChainNetwork | null {
  if (TRC20_ADDRESS.test(address)) return 'TRC20';
  if (BEP20_ADDRESS.test(address)) return 'BEP20';
  return null;
}

/**
 * A stable balance per wallet, in MINOR units at `USDT_SCALE`.
 *
 * Derived from the address rather than random, so the demo shows the same figure on every reload.
 */
function mockBalanceMinorFor(address: string): string {
  // Prefixed rather than guarded: base58 permits an address with no digit in it at all, and
  // `BigInt('')` throws where `BigInt('0')` is the zero this wants.
  const digits = address.replace(/\D/g, '').slice(-5);
  // A four-figure float, which is the order of magnitude a live payout wallet actually carries.
  return String(1_000_000_000n + BigInt(`0${digits}`) * 1_000n);
}

const unreadable = (
  base: Pick<WalletBalance, 'network' | 'address' | 'asset' | 'scale' | 'checkedAt'>,
  problem: string,
  detail: string,
): WalletBalance => ({ ...base, balanceMinor: null, balance: null, problem, detail });

/**
 * What one destination's wallet holds, from the ADDRESS and nothing else.
 *
 * The same signature the real service has — `DestinationBalanceService.read(address)` is told the
 * address and never the method — so the mock cannot answer a question the server would not have
 * been asked.
 */
export function mockWalletBalance(address: string, checkedAt: string): WalletBalance {
  const network = mockNetworkForAddress(address);
  const base = { network, address, asset: 'USDT', scale: USDT_SCALE, checkedAt };

  if (network === null) {
    // Not an address at all, so no chain was ever asked — almost always the seeded
    // `SEED-PLACEHOLDER-…` on a rail nobody has configured. 200 with a reason rather than an error,
    // because an unconfigured rail is an expected state, and the sentence has to name the
    // consequence: players have been sending money to that string.
    return unreadable(
      base,
      'ADDRESS_NOT_A_WALLET',
      'This destination is not a TRC20 or BEP20 address, so there is nothing on chain to read. Anything a player has already sent to it has gone nowhere.',
    );
  }

  if (address === UNREADABLE_WALLET_ADDRESS) {
    return unreadable(
      base,
      'CHAIN_NODE_UNAVAILABLE',
      `The ${CHAIN_NAMES[network]} node did not answer in time, so what this wallet holds is unknown — not zero.`,
    );
  }

  const balanceMinor = mockBalanceMinorFor(address);
  return {
    ...base,
    balanceMinor,
    balance: formatMinorToDecimal(minorFromString(balanceMinor), USDT_SCALE),
    problem: null,
    detail: null,
  };
}
