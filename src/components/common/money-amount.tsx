import { cn } from '@/lib/utils';
import { formatMinorString, formatMoney, type FormatMoneyOptions } from '@/lib/money';
import type { MoneyView } from '@/types/api';

/**
 * Every amount on screen goes through here: tabular figures so columns line up digit for digit, and
 * a monospace-ish rhythm so a transposed number is visible rather than merely present.
 *
 * `dir="ltr"` is not decoration. An amount is a Latin numeric run, and inside an Arabic paragraph
 * the bidi algorithm moves a LEADING MINUS SIGN to the visual end: `-200,000.00 NSP` is shown as
 * `NSP 200,000.00-`. On a reconciliation screen that is the difference between money owed and money
 * missing. Pinning the direction keeps the sign where it was written, in both languages.
 */
export function MoneyAmount({
  money,
  className,
  emphasis = false,
  ...options
}: FormatMoneyOptions & {
  money: MoneyView | null | undefined;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <span
      dir="ltr"
      className={cn(
        'tabular inline-block whitespace-nowrap',
        emphasis && 'font-semibold',
        className,
      )}
      data-testid="money"
    >
      {formatMoney(money, options)}
    </span>
  );
}

/** For reconciliation, whose money pairs carry no currency of their own. */
export function MinorAmount({
  minor,
  currency,
  className,
  signed = false,
}: {
  minor: string | null | undefined;
  currency?: string;
  className?: string;
  signed?: boolean;
}) {
  const negative = minor?.trim().startsWith('-') === true;
  return (
    <span
      dir="ltr"
      className={cn(
        'tabular inline-block whitespace-nowrap',
        signed && negative && 'text-[var(--danger)]',
        signed && !negative && minor != null && 'text-[var(--success)]',
        className,
      )}
    >
      {formatMinorString(minor, currency, { signed })}
    </span>
  );
}
