import { LOCALE_TAGS, type Locale } from './locales';

/**
 * How translation works here, and why it is not a library.
 *
 * ── BUNDLES LIVE WITH THE SCREEN THEY BELONG TO ───────────────────────────────────────────────
 * There is no single strings file. Each feature declares its own bundle beside its components with
 * `defineMessages({ en, ar })`, and `useT(bundle)` types the keys to THAT bundle. Two reasons: a
 * central file is a merge conflict every time two people touch different screens, and a key nobody
 * can trace back to a screen is a key nobody dares delete.
 *
 * ── ARABIC IS CHECKED BY THE COMPILER ─────────────────────────────────────────────────────────
 * `defineMessages` requires the `ar` half to cover every key in `en`. A string added to English
 * without an Arabic counterpart does not ship — it fails the build. That is the only mechanism that
 * actually keeps a second language current; a linter warning gets ignored by the third sprint.
 *
 * ── PLURALS ARE REAL ──────────────────────────────────────────────────────────────────────────
 * Arabic has six plural categories to English's two. A key that counts things declares its forms as
 * an object and `Intl.PluralRules` picks one per locale, so "2 deposits" reads as صفقتان and not as
 * ٢ صفقة. Keys that do not count things stay plain strings.
 */

/** The plural categories `Intl.PluralRules` can return. Arabic uses all six; English uses two. */
export interface PluralForms {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralForms;

export type Messages = Record<string, Message>;

export interface MessageBundle<T extends Messages = Messages> {
  readonly en: T;
  readonly ar: Record<keyof T, Message>;
}

/**
 * Declares a bundle. The `ar` type is derived from `en`, so a missing Arabic key is a type error at
 * the point it was forgotten rather than an English string leaking onto an Arabic screen.
 */
export function defineMessages<const T extends Messages>(bundle: {
  en: T;
  ar: Record<keyof T, Message>;
}): MessageBundle<T> {
  return bundle;
}

export type Interpolations = Record<string, string | number>;

const pluralRules = new Map<Locale, Intl.PluralRules>();

function selectPlural(locale: Locale, forms: PluralForms, count: number): string {
  let rules = pluralRules.get(locale);
  if (rules === undefined) {
    rules = new Intl.PluralRules(LOCALE_TAGS[locale]);
    pluralRules.set(locale, rules);
  }
  const category = rules.select(count);
  // `other` is required, so every category has somewhere to fall back to.
  return forms[category] ?? forms.other;
}

/**
 * `"{count} deposits waiting"` with `{ count: 3 }` becomes `"3 deposits waiting"`.
 *
 * A placeholder with no matching value is left as written rather than blanked: `{amount}` on screen
 * is an obvious bug report, an empty space is a silent one.
 */
function interpolate(template: string, values: Interpolations | undefined): string {
  if (values === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined ? whole : String(value);
  });
}

export function resolveMessage(
  message: Message | undefined,
  locale: Locale,
  values: Interpolations | undefined,
): string | undefined {
  if (message === undefined) return undefined;

  if (typeof message === 'string') return interpolate(message, values);

  const count = values?.count;
  const template = selectPlural(locale, message, typeof count === 'number' ? count : 0);
  return interpolate(template, values);
}

/**
 * Looks a key up in the feature bundle, then in the shared one, and finally gives back the key.
 *
 * Returning the key is deliberate: an untranslated screen shows `deposits.queue.title`, which reads
 * as a bug and gets fixed. Returning an empty string shows a blank card, which reads as "no data"
 * and gets shipped.
 */
export function translate(
  bundles: readonly MessageBundle[],
  locale: Locale,
  key: string,
  values?: Interpolations,
): string {
  for (const bundle of bundles) {
    const table = locale === 'ar' ? bundle.ar : bundle.en;
    const resolved = resolveMessage(table[key], locale, values);
    if (resolved !== undefined) return resolved;
  }

  // English is the source of truth, so an Arabic gap falls back to English before it falls to the
  // raw key — a half-translated screen should still be usable.
  if (locale !== 'en') {
    for (const bundle of bundles) {
      const resolved = resolveMessage(bundle.en[key], 'en', values);
      if (resolved !== undefined) return resolved;
    }
  }

  if (import.meta.env.DEV) {
    console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
  }
  return key;
}
