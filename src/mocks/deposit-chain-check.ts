import { formatMinorToDecimal, minorFromString } from '@/lib/money';
import { USDT_SCALE, type ChainNetwork, type DepositChainCheck } from '@/types';

/**
 * What the chain says about one deposit — in demo mode, and in every test that does not override it.
 *
 * ══ WHY THE MOCK HAS TO BE ABLE TO ANSWER BADLY ═══════════════════════════════════════════════
 * A mock where every transfer verifies would make five of the seven outcomes unreachable outside a
 * unit test — and the two that matter most are the two nobody would ever see. `suspect` is the one
 * a reviewer is INCLINED TO TRUST (the transfer is real, confirmed, and paid somebody else), and
 * `unavailable` is the one a reviewer must NOT read as a refusal (our node was down; it says
 * nothing about the deposit). Both are states this mock can produce on demand.
 *
 * ══ HOW AN OUTCOME IS CHOSEN ══════════════════════════════════════════════════════════════════
 * By the TX HASH the player submitted, which on a crypto rail is the deposit's
 * `externalReference` — the only thing tying an incoming transfer to whoever sent it. Named
 * sentinels rather than a hash of the id, so a fixture or a test asks for the state it wants by
 * name and a demo shows the same thing on every reload. Any other hash verifies.
 */

/**
 * A short USDT transfer, in µUSDT. Half a dollar, which is the shape a real shortfall takes: a
 * wallet that charged its own fee out of the transfer, not a player trying to steal 90% of one.
 */
const SHORTFALL_MINOR = 500_000n;

/** BSC wants a real depth; three of nineteen is a transfer submitted about a minute ago. */
const PENDING_CONFIRMATIONS = 3;
const REQUIRED_CONFIRMATIONS = 19;

/**
 * The tx hashes this mock answers a fixed verdict for.
 *
 * Sixty-four hex characters, so they pass the `referencePattern` the USDT rails carry and can be
 * pasted into a deposit fixture as a genuine reference.
 */
const hash = (marker: string): string => marker.repeat(64).slice(0, 64);

export const MOCK_TX_HASHES = {
  /** Confirmed, full amount, from a wallet this player has paid from before. */
  verified: hash('a1'),
  /** Real and short: the mismatch a human is asked to price. */
  mismatch: hash('b2'),
  /** Submitted seconds ago. Real, not yet deep enough to spend. */
  pending: hash('c3'),
  /** Real, confirmed, and paid A DIFFERENT wallet. The one that looks best and is worst. */
  suspect: hash('d4'),
  /** The chain has never heard of it. */
  missing: hash('e5'),
  /** Our node did not answer. Nothing at all is known about this deposit. */
  unavailable: hash('f6'),
} as const;

/** The wallet a suspect transfer actually paid — not the operator's, which is the point. */
export const MOCK_FOREIGN_DESTINATION = 'TWd4WrZ9wn84f5x1hZhL6ZKUZbHjPGuMdc';

/** The wallet the player pays from. Stable, so sender binding has something to recognise. */
const MOCK_SENDER = 'TKrsHFVLvQ2vX1t7iGbPtPHY4Yz9xB8dqA';

const usdt = (minor: bigint) => ({
  asset: 'USDT',
  scale: USDT_SCALE,
  minor: minor.toString(),
  amount: formatMinorToDecimal(minor, USDT_SCALE),
});

/**
 * USDT (six decimals) for an amount of tenant currency (two), at a rate quoted in tenant currency
 * per USDT (two).
 *
 * All bigint: the whole reason `money.ts` exists is that a rate of 13,200 applied to a seven-figure
 * NSP deposit leaves float arithmetic behind long before anybody notices.
 */
const toUsdtMinor = (currencyMinor: bigint, rateMinor: bigint): bigint =>
  (currencyMinor * 10n ** BigInt(USDT_SCALE)) / rateMinor;

/** And back — what arrived USDT is worth, which is the figure a reviewer would otherwise do by hand. */
const toCurrencyMinor = (usdtMinor: bigint, rateMinor: bigint): bigint =>
  (usdtMinor * rateMinor) / 10n ** BigInt(USDT_SCALE);

const money = (minor: bigint, currency: string) => ({
  minor: minor.toString(),
  amount: formatMinorToDecimal(minor),
  currency,
});

const nothing = (
  outcome: DepositChainCheck['outcome'],
  network: ChainNetwork | null,
  summary: string,
  checkedAt: string,
): DepositChainCheck => ({
  outcome,
  network,
  summary,
  arrived: null,
  creditable: null,
  txHash: null,
  fromAddress: null,
  confirmations: null,
  requiredConfirmations: null,
  checkedAt,
});

export interface MockChainCheckInput {
  /** Null when the deposit's rail is not CRYPTO, or its address is not on a chain either way. */
  network: ChainNetwork | null;
  /** What the player asked for, in tenant-currency minor units. */
  claimedMinor: string;
  currency: string;
  /** The tx hash the player submitted, i.e. the deposit's external reference. */
  txHash: string | null;
  /** Tenant currency per USDT, in minor units. Null when nobody has set a rate yet. */
  rateMinor: bigint | null;
  checkedAt: string;
}

export function mockDepositChainCheck(input: MockChainCheckInput): DepositChainCheck {
  const { network, currency, txHash, rateMinor, checkedAt } = input;

  if (network === null) {
    return nothing(
      'skipped',
      null,
      'This deposit was not paid on a chain, so there is nothing to read.',
      checkedAt,
    );
  }

  // A missing rate is genuinely OUR gap and tells a reviewer nothing about the transfer, which is
  // exactly what `unavailable` means. Reporting it as `missing` would say the chain looked and
  // found nothing — a statement about the player, made because of a blank field on our own screen.
  if (rateMinor === null || rateMinor <= 0n) {
    return nothing(
      'unavailable',
      network,
      'No USDT rate is set for this operator, so nothing on chain could be priced. This says nothing about the transfer.',
      checkedAt,
    );
  }

  if (txHash === null || txHash.trim().length === 0) {
    return nothing(
      'missing',
      network,
      'The player sent no transaction hash, so there is nothing to look up on chain.',
      checkedAt,
    );
  }

  if (txHash === MOCK_TX_HASHES.unavailable) {
    return {
      ...nothing(
        'unavailable',
        network,
        `The ${network} node did not answer in time. Nothing was read, and nothing here counts against this deposit.`,
        checkedAt,
      ),
      txHash,
    };
  }

  if (txHash === MOCK_TX_HASHES.missing) {
    return {
      ...nothing(
        'missing',
        network,
        `No ${network} transfer with this hash reached the operator's wallet.`,
        checkedAt,
      ),
      txHash,
    };
  }

  const expectedUsdt = toUsdtMinor(minorFromString(input.claimedMinor), rateMinor);

  if (txHash === MOCK_TX_HASHES.suspect) {
    return {
      outcome: 'suspect',
      network,
      summary: `This transfer is real and confirmed, and it paid ${MOCK_FOREIGN_DESTINATION} — not a wallet of this operator's. Crediting it would pay for somebody else's transfer.`,
      arrived: usdt(expectedUsdt),
      // Never priced. A figure beside a suspect transfer is an invitation to approve it.
      creditable: null,
      txHash,
      fromAddress: MOCK_SENDER,
      confirmations: REQUIRED_CONFIRMATIONS,
      requiredConfirmations: REQUIRED_CONFIRMATIONS,
      checkedAt,
    };
  }

  if (txHash === MOCK_TX_HASHES.pending) {
    return {
      outcome: 'pending',
      network,
      summary: `Found on ${network} and not yet deep enough to spend. A transfer this shallow can still be reorganised out of the chain.`,
      arrived: usdt(expectedUsdt),
      // Deliberately unpriced: there is nothing to credit until it confirms.
      creditable: null,
      txHash,
      fromAddress: MOCK_SENDER,
      confirmations: PENDING_CONFIRMATIONS,
      requiredConfirmations: REQUIRED_CONFIRMATIONS,
      checkedAt,
    };
  }

  if (txHash === MOCK_TX_HASHES.mismatch) {
    const arrivedUsdt = expectedUsdt - SHORTFALL_MINOR;
    return {
      outcome: 'mismatch',
      network,
      summary: `Less arrived than was claimed: ${formatMinorToDecimal(arrivedUsdt, USDT_SCALE)} USDT against ${formatMinorToDecimal(expectedUsdt, USDT_SCALE)} USDT expected.`,
      arrived: usdt(arrivedUsdt),
      creditable: money(toCurrencyMinor(arrivedUsdt, rateMinor), currency),
      txHash,
      fromAddress: MOCK_SENDER,
      confirmations: REQUIRED_CONFIRMATIONS,
      requiredConfirmations: REQUIRED_CONFIRMATIONS,
      checkedAt,
    };
  }

  return {
    outcome: 'verified',
    network,
    summary: `Confirmed on ${network}, for the full amount, from a wallet this player has paid from before.`,
    arrived: usdt(expectedUsdt),
    creditable: money(toCurrencyMinor(expectedUsdt, rateMinor), currency),
    txHash,
    fromAddress: MOCK_SENDER,
    confirmations: REQUIRED_CONFIRMATIONS,
    requiredConfirmations: REQUIRED_CONFIRMATIONS,
    checkedAt,
  };
}
