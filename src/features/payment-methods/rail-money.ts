import { formatMinorToDecimal, parseDecimalToMinor } from '@/lib/money';
// The wire shape, not the one in money.ts: `<MoneyAmount>` takes the schema's loose object.
import type { MoneyView } from '@/types/api';

/**
 * Limits, fees and caps arrive from the payment-method endpoints as bare decimal strings, with the
 * currency living on the method rather than on each amount. Putting them back together here keeps
 * every figure on this screen going through `formatMoney` — the alternative, concatenating the
 * amount and the code in JSX, is how one screen ends up grouping digits differently from the rest
 * of the console, and how an operator misreads 5,000,000 as 500,000.
 */

export function railMoney(amount: string, currency: string): MoneyView {
  return { minor: minorOf(amount), amount, currency };
}

/** `dailyCap` is nullable and `formatMoney` already renders null as an em dash. */
export function optionalRailMoney(amount: string | null, currency: string): MoneyView | null {
  return amount === null ? null : railMoney(amount, currency);
}

/** Normalises what an operator typed into the decimal the backend stores: `50000` -> `50000.00`. */
export function normaliseAmount(input: string): string {
  return formatMinorToDecimal(parseDecimalToMinor(input.trim()));
}

/** True when this console can round-trip the string through minor units without losing a digit. */
export function isRoundTrippableAmount(input: string): boolean {
  try {
    parseDecimalToMinor(input.trim());
    return true;
  } catch {
    return false;
  }
}

// An amount the backend swears is well formed must still not take a whole table down if it is not,
// so a decimal this cannot parse keeps its own text and loses only its minor units.
function minorOf(amount: string): string {
  return isRoundTrippableAmount(amount) ? parseDecimalToMinor(amount.trim()).toString() : '0';
}
