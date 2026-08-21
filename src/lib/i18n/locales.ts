/**
 * Which languages the console speaks, and which way each one reads.
 *
 * Arabic here is not a translation layer bolted onto an English screen — the whole console mirrors.
 * A cashier reading an Arabic queue expects the short id where their eye starts, the sidebar on the
 * right, and the chevron on a "next page" button pointing left. Half-mirrored is worse than not
 * mirrored, which is why `dir` is set on the document and every component uses logical properties.
 *
 * NUMBERS STAY WESTERN, in both languages. Arabic-Indic digits (٠١٢٣) are more native to read, but
 * this console is used with a bank app and the Ichancy agent panel open beside it, both of which
 * show 1,500.00. A reviewer comparing two amounts must not have to transliterate between them —
 * that is a transcription error waiting to be made on the money path.
 */

export const LOCALES = ['en', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export type Direction = 'ltr' | 'rtl';

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  en: 'ltr',
  ar: 'rtl',
};

/** What each language calls itself. Never translated — a language picker is read by someone who
 *  cannot yet read the current language. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

/** The tag handed to Intl and to date-fns. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  ar: 'ar',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): Direction {
  return LOCALE_DIRECTION[locale];
}

/**
 * Picks a starting language from the browser, once, on a first visit. `ar-SY`, `ar-EG` and bare
 * `ar` all mean Arabic; anything else falls back to English rather than guessing.
 */
export function detectLocale(languages?: readonly string[]): Locale {
  const candidates = languages ?? (navigator as { languages?: readonly string[] }).languages ?? [];
  for (const language of candidates) {
    const base = language.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
