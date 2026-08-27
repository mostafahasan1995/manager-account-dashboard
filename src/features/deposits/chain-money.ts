import { formatMinorToDecimal, minorFromString } from '@/lib/money';
import type { ChainArrival, MoneyView } from '@/types';

/**
 * The one place USDT that arrived on chain becomes something this console may render.
 *
 * ══ WHY IT IS NOT JUST `formatMoney(arrived)` ═════════════════════════════════════════════════
 * `ChainArrival` is USDT at SIX decimals; every money helper in this console defaults to two. Hand
 * `99500000` to the default scale and the screen shows `995,000.00` — ten thousand times the truth,
 * in the exact figure a reviewer is about to approve somebody's deposit on. So the scale travels
 * with the response and is passed explicitly here.
 *
 * The type does the rest of the work: `ChainArrival` carries `asset`, not `currency`, so it is not
 * assignable to `MoneyView` and `formatMoney(arrived)` does not compile. This function is the only
 * bridge between the two, and it is deliberately narrow enough to read in one sitting.
 *
 * Null rather than a guess for minor units this console cannot parse. An amount nobody can read is
 * not zero, and it is not the server's own pre-formatted `amount` either — one number on screen,
 * from one source, or none at all. Same rule the wallet balance card lives by.
 */
export function arrivedAsMoney(arrived: ChainArrival | null): MoneyView | null {
  if (arrived === null) return null;

  try {
    return {
      minor: arrived.minor,
      amount: formatMinorToDecimal(minorFromString(arrived.minor), arrived.scale),
      currency: arrived.asset,
    };
  } catch {
    return null;
  }
}
