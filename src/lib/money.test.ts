import { describe, expect, it } from 'vitest';

import {
  differsFrom,
  formatMinorString,
  formatMinorToDecimal,
  formatMoney,
  groupDecimal,
  isZeroDecimal,
  minorFromString,
  MoneyError,
  parseDecimalToMinor,
  sumMoney,
  toMoneyBody,
} from './money';

/**
 * These are the tests that matter most in the whole suite.
 *
 * Everything else here renders a number; this decides what the number IS. A rounding bug in a
 * cashier console is not a display bug — it is a reviewer approving 1,500.01 as 1,500.00 and a
 * ledger that no longer balances.
 */

describe('parseDecimalToMinor', () => {
  it.each([
    ['0', 0n],
    ['0.00', 0n],
    ['1500', 150_000n],
    ['1500.00', 150_000n],
    ['1500.5', 150_050n],
    ['1500.55', 150_055n],
    ['-42.75', -4_275n],
  ])('parses %s to %s minor units', (input, expected) => {
    expect(parseDecimalToMinor(input)).toBe(expected);
  });

  it('keeps full precision past what a double can hold', () => {
    // 9007199254740993 is Number.MAX_SAFE_INTEGER + 2; as a float it silently becomes ...992.
    expect(parseDecimalToMinor('90071992547409.93')).toBe(9_007_199_254_740_993n);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDecimalToMinor('  12.30  ')).toBe(1_230n);
  });

  it.each(['', 'abc', '1,500.00', '1e3', '1.2.3', '--5', '1500.'])(
    'refuses %s rather than guessing',
    (input) => {
      expect(() => parseDecimalToMinor(input)).toThrow(MoneyError);
    },
  );

  it('refuses more decimals than the currency has', () => {
    expect(() => parseDecimalToMinor('1.234')).toThrow(
      /has 3 decimals but the currency scale is 2/,
    );
  });

  it('honours a wider scale when asked', () => {
    expect(parseDecimalToMinor('1.2345', 4)).toBe(12_345n);
  });
});

describe('formatMinorToDecimal', () => {
  it.each([
    [0n, '0.00'],
    [5n, '0.05'],
    [50n, '0.50'],
    [150_000n, '1500.00'],
    [-4_275n, '-42.75'],
  ])('renders %s as %s', (minor, expected) => {
    expect(formatMinorToDecimal(minor)).toBe(expected);
  });

  it('round-trips every value it parses', () => {
    for (const value of ['0.00', '0.01', '99.99', '1500.00', '-8.40', '90071992547409.93']) {
      expect(formatMinorToDecimal(parseDecimalToMinor(value))).toBe(value);
    }
  });
});

describe('minorFromString', () => {
  it('reads minor units that exceed Number.MAX_SAFE_INTEGER', () => {
    expect(minorFromString('9007199254740993')).toBe(9_007_199_254_740_993n);
  });

  it('rejects anything that is not an integer', () => {
    expect(() => minorFromString('12.5')).toThrow(MoneyError);
    expect(() => minorFromString('abc')).toThrow(/Not a minor-unit integer/);
  });
});

describe('groupDecimal', () => {
  it.each([
    ['1500.00', '1,500.00'],
    ['999.99', '999.99'],
    ['1000000.00', '1,000,000.00'],
    ['-1234567.89', '-1,234,567.89'],
    ['0.00', '0.00'],
  ])('groups %s as %s', (input, expected) => {
    expect(groupDecimal(input)).toBe(expected);
  });
});

describe('formatMoney', () => {
  const money = { minor: '150000', amount: '1500.00', currency: 'NSP' };

  it('renders the grouped amount with its currency', () => {
    expect(formatMoney(money)).toBe('1,500.00 NSP');
  });

  it('renders an em dash for a missing amount rather than 0', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });

  it('can drop the currency and the grouping', () => {
    expect(formatMoney(money, { withCurrency: false })).toBe('1,500.00');
    expect(formatMoney(money, { group: false, withCurrency: false })).toBe('1500.00');
  });

  it('signs deltas, but never signs a zero', () => {
    expect(formatMoney(money, { signed: true })).toBe('+1,500.00 NSP');
    expect(formatMoney({ minor: '-500', amount: '-5.00', currency: 'NSP' }, { signed: true })).toBe(
      '-5.00 NSP',
    );
    expect(formatMoney({ minor: '0', amount: '0.00', currency: 'NSP' }, { signed: true })).toBe(
      '0.00 NSP',
    );
  });
});

describe('formatMinorString', () => {
  it('formats a bare minor-unit string', () => {
    expect(formatMinorString('150000')).toBe('1,500.00');
  });

  it('adds the currency only when one is given', () => {
    expect(formatMinorString('150000', 'NSP')).toBe('1,500.00 NSP');
  });

  it('renders an em dash for null', () => {
    expect(formatMinorString(null)).toBe('—');
  });
});

describe('isZeroDecimal', () => {
  it.each([
    ['0', true],
    ['0.00', true],
    ['-0.00', true],
    ['0.01', false],
    ['10.00', false],
  ])('reports %s as zero: %s', (input, expected) => {
    expect(isZeroDecimal(input)).toBe(expected);
  });
});

describe('toMoneyBody', () => {
  it('normalises the amount the API will receive', () => {
    expect(toMoneyBody('1500', 'NSP')).toEqual({ amount: '1500.00', currencyCode: 'NSP' });
  });

  it('throws on input the backend would reject, before it is sent', () => {
    expect(() => toMoneyBody('1,500', 'NSP')).toThrow(MoneyError);
  });
});

describe('differsFrom', () => {
  const claimed = { minor: '150000', amount: '1500.00', currency: 'NSP' };

  it('compares by minor units, not by string', () => {
    expect(differsFrom(claimed, { minor: '150000', amount: '1500.0', currency: 'NSP' })).toBe(
      false,
    );
    expect(differsFrom(claimed, { minor: '150001', amount: '1500.01', currency: 'NSP' })).toBe(
      true,
    );
  });

  it('treats a missing side as "no difference to report"', () => {
    expect(differsFrom(claimed, null)).toBe(false);
    expect(differsFrom(null, claimed)).toBe(false);
  });
});

describe('sumMoney', () => {
  it('sums exactly, in minor units', () => {
    const total = sumMoney([
      { minor: '150000', amount: '1500.00', currency: 'NSP' },
      { minor: '2599', amount: '25.99', currency: 'NSP' },
    ]);
    expect(total).toEqual({ minor: '152599', amount: '1525.99', currency: 'NSP' });
  });

  it('returns null for an empty list rather than a fake zero', () => {
    expect(sumMoney([])).toBeNull();
  });
});
