/**
 * Money, mirrored from the backend's `common/helpers/money.util.ts`.
 *
 * The rule that matters: an amount is NEVER a JavaScript number in this app. It arrives as minor
 * units in a string ("150000") or a plain decimal string ("1500.00"), it is parsed to `bigint`, and
 * it is rendered back to a string. `parseFloat` on a cashier amount is how a console shows 1500.01
 * as 1500.0000000000002 — and how a reviewer approves the wrong figure.
 *
 * These functions round-trip exactly with the backend's, so a value edited here and posted back is
 * the same value it started as.
 */

export const DEFAULT_MONEY_SCALE = 2;

/** The wire format the backend accepts: optional sign, digits, optional fraction. No exponents. */
export const MONEY_STRING_REGEX = /^-?\d{1,18}(\.\d{1,6})?$/;

const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

export type MoneyErrorCode = 'INVALID_DECIMAL' | 'TOO_MANY_DECIMALS' | 'INVALID_MINOR';

export class MoneyError extends Error {
  readonly code: MoneyErrorCode;

  constructor(code: MoneyErrorCode, message: string) {
    super(message);
    this.name = 'MoneyError';
    this.code = code;
  }
}

/** The `{ minor, amount, currency }` object the backend sends for every amount. */
export interface MoneyView {
  minor: string;
  amount: string;
  currency: string;
}

/** `"1500.00"` -> `150000n`. Throws rather than guessing at anything it cannot represent. */
export function parseDecimalToMinor(input: string, scale: number = DEFAULT_MONEY_SCALE): bigint {
  const match = DECIMAL_RE.exec(input.trim());
  if (!match) {
    throw new MoneyError('INVALID_DECIMAL', `Not a plain decimal amount: "${input}"`);
  }
  const sign = match[1] ?? '';
  const whole = match[2] ?? '0';
  const fraction = match[3] ?? '';
  if (fraction.length > scale) {
    throw new MoneyError(
      'TOO_MANY_DECIMALS',
      `"${input}" has ${fraction.length} decimals but the currency scale is ${scale}`,
    );
  }
  const magnitude = BigInt(whole + fraction.padEnd(scale, '0'));
  return sign === '-' ? -magnitude : magnitude;
}

/** `150000n` -> `"1500.00"`. Exact inverse of `parseDecimalToMinor`. */
export function formatMinorToDecimal(minor: bigint, scale: number = DEFAULT_MONEY_SCALE): string {
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(scale + 1, '0');
  const cut = digits.length - scale;
  const whole = digits.slice(0, cut);
  const fraction = scale > 0 ? `.${digits.slice(cut)}` : '';
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/** Minor units as they arrive from the wire (a string, because they can exceed Number.MAX_SAFE). */
export function minorFromString(minor: string): bigint {
  const trimmed = minor.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new MoneyError('INVALID_MINOR', `Not a minor-unit integer: "${minor}"`);
  }
  return BigInt(trimmed);
}

/**
 * Group digits for display: `"1500.00"` -> `"1,500.00"`.
 *
 * Deliberately string-based rather than `Intl.NumberFormat`, which takes a `number` and would
 * silently lose precision on large NSP amounts before it ever formatted them.
 */
export function groupDecimal(decimal: string, groupSeparator = ','): string {
  const [wholeRaw = '0', fraction] = decimal.split('.');
  const negative = wholeRaw.startsWith('-');
  const whole = negative ? wholeRaw.slice(1) : wholeRaw;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  return `${negative ? '-' : ''}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}

export interface FormatMoneyOptions {
  /** Show the currency code after the amount. Default true. */
  withCurrency?: boolean;
  /** Thousands separators. Default true. */
  group?: boolean;
  /** Always show a leading + on positive, non-zero amounts. For deltas. */
  signed?: boolean;
}

/** The one function every screen uses to render an amount. */
export function formatMoney(
  money: MoneyView | null | undefined,
  options: FormatMoneyOptions = {},
): string {
  if (money == null) return '—';
  const { withCurrency = true, group = true, signed = false } = options;
  const body = group ? groupDecimal(money.amount) : money.amount;
  const sign = signed && !body.startsWith('-') && !isZeroDecimal(money.amount) ? '+' : '';
  return withCurrency ? `${sign}${body} ${money.currency}` : `${sign}${body}`;
}

/** Same, for the raw `{ minor, amount }` pairs reconciliation sends (no currency on the object). */
export function formatMinorString(
  minor: string | null | undefined,
  currency?: string,
  options: FormatMoneyOptions = {},
): string {
  if (minor == null) return '—';
  const decimal = formatMinorToDecimal(minorFromString(minor));
  return formatMoney(
    { minor, amount: decimal, currency: currency ?? '' },
    { withCurrency: currency !== undefined, ...options },
  );
}

export function isZeroDecimal(decimal: string): boolean {
  return /^-?0(\.0+)?$/.test(decimal.trim());
}

/** Builds the `{ amount, currencyCode }` body the approve endpoint expects. */
export function toMoneyBody(
  amount: string,
  currencyCode: string,
): { amount: string; currencyCode: string } {
  // Normalising through minor units rejects "1,500.00" and "1e3" here rather than at the server.
  return { amount: formatMinorToDecimal(parseDecimalToMinor(amount)), currencyCode };
}

/** True when the two amounts differ — used to flag "verified ≠ claimed" in review. */
export function differsFrom(a: MoneyView | null | undefined, b: MoneyView | null | undefined) {
  if (a == null || b == null) return false;
  return minorFromString(a.minor) !== minorFromString(b.minor);
}

/** Sum of a column of `MoneyView`s. Returns null for an empty list rather than a fake zero. */
export function sumMoney(items: readonly MoneyView[]): MoneyView | null {
  const first = items[0];
  if (first === undefined) return null;
  const total = items.reduce((acc, item) => acc + minorFromString(item.minor), 0n);
  return { minor: total.toString(), amount: formatMinorToDecimal(total), currency: first.currency };
}
