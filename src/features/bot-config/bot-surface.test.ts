import { describe, expect, it } from 'vitest';

import { parseDecimalToMinor } from '@/lib/money';
import { mockPaymentMethods } from '@/mocks/fixtures';
import type { PaymentMethod } from '@/types';

import {
  BOT_COMMANDS,
  CALLBACK_DATA_MAX_BYTES,
  depositCallbackData,
  offerableMethods,
  previewKeyboard,
  utf8Bytes,
} from './bot-surface';

/**
 * The mirror is the thing under test.
 *
 * This module reproduces four rules the bot applies before it draws a keyboard, and the preview is
 * only worth having if it reproduces them exactly — a preview that shows a button the player will
 * not get is worse than no preview, because it turns "my rail is missing" into an argument about
 * whether the console is lying.
 */

const minorOf = (decimal: string) => parseDecimalToMinor(decimal);

const method = (overrides: Partial<PaymentMethod>): PaymentMethod => ({
  ...mockPaymentMethods[0]!,
  ...overrides,
});

const CURRENCY = mockPaymentMethods[0]!.currencyCode;

describe('which methods the bot would offer', () => {
  it('leaves out an inactive method, which is what the switch on this screen does', () => {
    const rows = [
      method({ id: 'a', displayName: 'On', isActive: true }),
      method({ id: 'b', displayName: 'Off', isActive: false }),
    ];

    expect(offerableMethods(rows, CURRENCY).map((row) => row.displayName)).toEqual(['On']);
  });

  it('leaves out the internal rail, which exists for corrections and has nothing to pay into', () => {
    const rows = [
      method({ id: 'a', displayName: 'Bank', rail: 'BANK_TRANSFER' }),
      method({ id: 'b', displayName: 'Corrections', rail: 'INTERNAL' }),
    ];

    expect(offerableMethods(rows, CURRENCY).map((row) => row.displayName)).toEqual(['Bank']);
  });

  it('leaves out another currency: a player is only offered rails in their own', () => {
    const rows = [
      method({ id: 'a', displayName: 'Home', currencyCode: CURRENCY }),
      method({ id: 'b', displayName: 'Elsewhere', currencyCode: 'USD' }),
    ];

    expect(offerableMethods(rows, CURRENCY).map((row) => row.displayName)).toEqual(['Home']);
  });

  it('breaks a tie on sortOrder alphabetically, the way the bot orders its query', () => {
    const rows = [
      method({ id: 'a', displayName: 'Zebra', sortOrder: 1 }),
      method({ id: 'b', displayName: 'Alpha', sortOrder: 1 }),
      method({ id: 'c', displayName: 'First', sortOrder: 0 }),
    ];

    expect(offerableMethods(rows, CURRENCY).map((row) => row.displayName)).toEqual([
      'First',
      'Alpha',
      'Zebra',
    ]);
  });
});

describe('the keyboard for one amount', () => {
  const rows = [
    method({ id: 'a', displayName: 'Small', minAmount: '10.00', maxAmount: '100.00' }),
    method({ id: 'b', displayName: 'Large', minAmount: '1000.00', maxAmount: '5000.00' }),
  ];

  it('offers only the methods whose limits take the amount', () => {
    const preview = previewKeyboard(rows, CURRENCY, minorOf('2000.00'), minorOf);

    expect(preview.buttons.map((button) => button.method.displayName)).toEqual(['Large']);
    expect(preview.outOfRange.map((row) => row.displayName)).toEqual(['Small']);
  });

  it('reports that the bot sends NO keyboard when exactly one method qualifies', () => {
    // The surprising one, and the reason the preview exists: a single button is a tap that carries
    // no information, so the bot skips straight to opening the deposit.
    expect(previewKeyboard(rows, CURRENCY, minorOf('2000.00'), minorOf).skipsKeyboard).toBe(true);
  });

  it('draws buttons once two methods qualify', () => {
    const both = [
      method({ id: 'a', displayName: 'One', minAmount: '10.00', maxAmount: '5000.00' }),
      method({ id: 'b', displayName: 'Two', minAmount: '10.00', maxAmount: '5000.00' }),
    ];
    const preview = previewKeyboard(both, CURRENCY, minorOf('100.00'), minorOf);

    expect(preview.skipsKeyboard).toBe(false);
    expect(preview.buttons).toHaveLength(2);
  });

  it('includes an amount exactly on a limit, because the bot compares inclusively', () => {
    const preview = previewKeyboard(rows, CURRENCY, minorOf('100.00'), minorOf);

    expect(preview.buttons.map((button) => button.method.displayName)).toEqual(['Small']);
  });
});

describe('the 64-byte callback payload', () => {
  it('does not count the label, which is the whole point of showing the number', () => {
    const plain = method({ id: 'abc', displayName: 'Bank' });
    const decorated = method({ id: 'abc', displayName: '🏦 حوالة بنكية — أسرع طريقة 💸' });
    const amount = minorOf('50000.00');

    expect(utf8Bytes(depositCallbackData(decorated.id, amount))).toBe(
      utf8Bytes(depositCallbackData(plain.id, amount)),
    );
  });

  it('measures the real payload: namespace, method id and the amount in minor units', () => {
    expect(depositCallbackData('7f2a', 1500n)).toBe('pdep:7f2a:1500');
  });

  it('stays inside the cap for a uuid method id at a large amount', () => {
    const uuid = mockPaymentMethods[0]!.id;

    expect(utf8Bytes(depositCallbackData(uuid, minorOf('10000000.00')))).toBeLessThanOrEqual(
      CALLBACK_DATA_MAX_BYTES,
    );
  });

  it('marks a method as dropped once its payload goes over — the bot leaves it out silently', () => {
    const preview = previewKeyboard(
      [method({ id: 'x'.repeat(70), displayName: 'Too long', minAmount: '1.00' })],
      CURRENCY,
      minorOf('50000.00'),
      minorOf,
    );

    expect(preview.buttons[0]?.dropped).toBe(true);
  });
});

describe('the advertised command list', () => {
  it('carries the ten player commands and the six staff ones', () => {
    expect(BOT_COMMANDS.filter((row) => row.audience === 'PLAYER')).toHaveLength(10);
    expect(BOT_COMMANDS.filter((row) => row.audience === 'ADMIN')).toHaveLength(6);
  });

  it('keeps /console in the staff list, which is the command a new operator signs in with', () => {
    expect(BOT_COMMANDS.find((row) => row.command === 'console')?.audience).toBe('ADMIN');
  });
});
