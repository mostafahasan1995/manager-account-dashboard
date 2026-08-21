import { describe, expect, it, vi } from 'vitest';

import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  BREAK_CATEGORIES,
  BREAK_CATEGORY_LABELS,
  BREAK_STATUSES,
  BREAK_STATUS_LABELS,
  DEPOSIT_SORTS,
  DEPOSIT_SORT_LABELS,
  DEPOSIT_STATUSES,
  DEPOSIT_STATUS_LABELS,
  PAYMENT_RAILS,
  PAYMENT_RAIL_LABELS,
  PLAYER_STATUSES,
  PLAYER_STATUS_LABELS,
  REJECTION_CODES,
  REJECTION_CODE_LABELS,
  RISK_FLAG_LABELS,
  TENANT_STATUSES,
  TENANT_STATUS_LABELS,
  VERIFICATION_MODES,
  VERIFICATION_MODE_LABELS,
} from '@/types/enums';

import { commonMessages } from './common-messages';
import { detectLocale, directionOf, isLocale, LOCALES } from './locales';
import { defineMessages, translate, type Message } from './messages';

/**
 * Two things are being defended here.
 *
 * The first is that ARABIC NEVER FALLS BEHIND. TypeScript already refuses a bundle whose `ar` half
 * is missing a key, so these tests cover what the compiler cannot see: that no Arabic value was
 * left as its English placeholder, and that a key which counts things declares Arabic's plural
 * forms rather than English's two.
 *
 * The second is that the `enum.*` keys AGREE WITH `src/types/enums.ts`. The English label exists in
 * both places — one drives the message table, the other is used by non-visual code — and two copies
 * of a string stay honest only while something checks them.
 */

const enumGroups: Record<string, { values: readonly string[]; labels: Record<string, string> }> = {
  depositStatus: { values: DEPOSIT_STATUSES, labels: DEPOSIT_STATUS_LABELS },
  rejectionCode: { values: REJECTION_CODES, labels: REJECTION_CODE_LABELS },
  playerStatus: { values: PLAYER_STATUSES, labels: PLAYER_STATUS_LABELS },
  adminRole: { values: ADMIN_ROLES, labels: ADMIN_ROLE_LABELS },
  paymentRail: { values: PAYMENT_RAILS, labels: PAYMENT_RAIL_LABELS },
  verificationMode: { values: VERIFICATION_MODES, labels: VERIFICATION_MODE_LABELS },
  breakCategory: { values: BREAK_CATEGORIES, labels: BREAK_CATEGORY_LABELS },
  breakStatus: { values: BREAK_STATUSES, labels: BREAK_STATUS_LABELS },
  tenantStatus: { values: TENANT_STATUSES, labels: TENANT_STATUS_LABELS },
  depositSort: { values: DEPOSIT_SORTS, labels: DEPOSIT_SORT_LABELS },
  riskFlag: { values: Object.keys(RISK_FLAG_LABELS), labels: RISK_FLAG_LABELS },
};

const asString = (message: Message | undefined): string | undefined =>
  typeof message === 'string' ? message : message?.other;

/**
 * The bundle's keys are a literal union — which is exactly what makes a missing Arabic string a
 * compile error, and exactly why a test that walks the table by name cannot index it directly.
 */
const en = commonMessages.en as Record<string, Message | undefined>;
const ar = commonMessages.ar as Record<string, Message | undefined>;

describe('every backend enum is translated', () => {
  for (const [group, { values, labels }] of Object.entries(enumGroups)) {
    describe(group, () => {
      it.each(values)('has an English and an Arabic label for %s', (value) => {
        const key = `enum.${group}.${value}`;
        expect(en[key], `${key} is missing from English`).toBeTruthy();
        expect(ar[key], `${key} is missing from Arabic`).toBeTruthy();
      });

      it.each(values)('does not disagree with the label map for %s', (value) => {
        expect(asString(en[`enum.${group}.${value}`])).toBe(labels[value]);
      });
    });
  }
});

describe('the Arabic half', () => {
  const englishOnly = new Set([
    // Read as symbols in both languages, like `kg`. See format.ts.
    'countdown.expired',
  ]);

  it('covers every English key', () => {
    for (const key of Object.keys(en)) {
      expect(ar[key], `${key} has no Arabic`).toBeDefined();
    }
  });

  it('is actually in Arabic, not English left in place', () => {
    const untranslated: string[] = [];

    for (const [key, message] of Object.entries(ar)) {
      if (englishOnly.has(key)) continue;
      const text = asString(message) ?? '';
      // A value with no Arabic letter at all is either a placeholder or a forgotten copy-paste.
      // Values that are only punctuation or an interpolation are exempt.
      const hasArabic = /[؀-ۿ]/.test(text);
      const hasLetters = /[A-Za-z]/.test(text.replace(/\{[^}]+\}/g, ''));
      if (!hasArabic && hasLetters) untranslated.push(key);
    }

    expect(untranslated).toEqual([]);
  });

  it('declares Arabic plural forms wherever a key counts things', () => {
    for (const [key, message] of Object.entries(ar)) {
      if (message === undefined || typeof message === 'string') continue;
      // Arabic distinguishes two and a small count; a bundle that only copied English's one/other
      // would read wrongly for exactly the numbers a queue shows most.
      expect(message.two, `${key} has no dual form`).toBeDefined();
      expect(message.few, `${key} has no few form`).toBeDefined();
    }
  });
});

describe('translate', () => {
  const bundle = defineMessages({
    en: {
      'test.plain': 'Hello',
      'test.interpolated': '{count} deposits for {name}',
      'test.plural': { one: '{count} deposit', other: '{count} deposits' },
      'test.englishOnly': 'Only English',
    },
    ar: {
      'test.plain': 'مرحباً',
      'test.interpolated': '{count} إيداعات لـ {name}',
      'test.plural': {
        zero: 'لا إيداعات',
        one: 'إيداع واحد',
        two: 'إيداعان',
        few: '{count} إيداعات',
        many: '{count} إيداعاً',
        other: '{count} إيداع',
      },
      'test.englishOnly': 'بالعربية',
    },
  });

  it('reads the language asked for', () => {
    expect(translate([bundle], 'en', 'test.plain')).toBe('Hello');
    expect(translate([bundle], 'ar', 'test.plain')).toBe('مرحباً');
  });

  it('substitutes values, in either language', () => {
    expect(translate([bundle], 'en', 'test.interpolated', { count: 3, name: 'Karim' })).toBe(
      '3 deposits for Karim',
    );
    expect(translate([bundle], 'ar', 'test.interpolated', { count: 3, name: 'كريم' })).toBe(
      '3 إيداعات لـ كريم',
    );
  });

  it('leaves an unmatched placeholder visible rather than blanking it', () => {
    expect(translate([bundle], 'en', 'test.interpolated', { count: 3 })).toContain('{name}');
  });

  it('picks the English plural by count', () => {
    expect(translate([bundle], 'en', 'test.plural', { count: 1 })).toBe('1 deposit');
    expect(translate([bundle], 'en', 'test.plural', { count: 5 })).toBe('5 deposits');
  });

  it("picks Arabic's dual and few forms, which English does not have", () => {
    expect(translate([bundle], 'ar', 'test.plural', { count: 0 })).toBe('لا إيداعات');
    expect(translate([bundle], 'ar', 'test.plural', { count: 1 })).toBe('إيداع واحد');
    expect(translate([bundle], 'ar', 'test.plural', { count: 2 })).toBe('إيداعان');
    expect(translate([bundle], 'ar', 'test.plural', { count: 5 })).toBe('5 إيداعات');
    expect(translate([bundle], 'ar', 'test.plural', { count: 20 })).toBe('20 إيداعاً');
  });

  it('falls through to the shared bundle', () => {
    expect(translate([bundle, commonMessages], 'en', 'common.cancel')).toBe('Cancel');
    expect(translate([bundle, commonMessages], 'ar', 'common.cancel')).toBe('إلغاء');
  });

  it('returns the key itself when nothing has it, so the gap is visible on screen', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(translate([bundle], 'en', 'test.missing')).toBe('test.missing');
  });
});

describe('locales', () => {
  it('knows which way each language reads', () => {
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('ar')).toBe('rtl');
  });

  it('recognises the languages it speaks and nothing else', () => {
    expect(LOCALES).toEqual(['en', 'ar']);
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('detects Arabic from any regional variant', () => {
    expect(detectLocale(['ar-SY', 'en-US'])).toBe('ar');
    expect(detectLocale(['ar'])).toBe('ar');
    expect(detectLocale(['AR-EG'])).toBe('ar');
  });

  it('falls back to English rather than guessing at an unknown language', () => {
    expect(detectLocale(['fr-FR', 'de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});
