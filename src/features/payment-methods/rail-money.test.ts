import { describe, expect, it } from 'vitest';

import {
  isRoundTrippableAmount,
  normaliseAmount,
  optionalRailMoney,
  railMoney,
} from './rail-money';

describe('railMoney', () => {
  it('rebuilds the minor units the wire left off', () => {
    expect(railMoney('50000.00', 'NSP')).toEqual({
      minor: '5000000',
      amount: '50000.00',
      currency: 'NSP',
    });
  });

  it('keeps rendering an amount it cannot parse instead of taking the table down', () => {
    expect(railMoney('not money', 'NSP')).toEqual({
      minor: '0',
      amount: 'not money',
      currency: 'NSP',
    });
  });

  it('leaves a missing cap missing, so it renders as an em dash rather than as zero', () => {
    expect(optionalRailMoney(null, 'NSP')).toBeNull();
    expect(optionalRailMoney('100.00', 'NSP')?.amount).toBe('100.00');
  });
});

describe('normaliseAmount', () => {
  it('pads what an operator typed out to the scale the backend stores', () => {
    expect(normaliseAmount('50000')).toBe('50000.00');
    expect(normaliseAmount(' 1.5 ')).toBe('1.50');
  });

  it('refuses anything it would have to guess at', () => {
    expect(isRoundTrippableAmount('1,500.00')).toBe(false);
    expect(isRoundTrippableAmount('1.005')).toBe(false);
    expect(isRoundTrippableAmount('1500')).toBe(true);
  });
});
