import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { I18nContext, LOCALE_STORAGE_KEY, type I18nState } from './i18n-context';
import { detectLocale, directionOf, isLocale, LOCALE_TAGS, type Locale } from './locales';

/**
 * Language is a per-machine preference, like the theme: `localStorage`, not the session. A cashier
 * who reads Arabic reads Arabic tomorrow too, and on a shared machine the next person changes it
 * once rather than every shift.
 *
 * The FIRST visit is detected from the browser. After that the stored choice wins, always — an
 * operator who deliberately switched to English must not be flipped back by a phone that reports
 * `ar-SY`.
 */

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale() ?? detectLocale());

  const direction = directionOf(locale);

  // `dir` and `lang` go on <html>, not on a wrapper div: they drive the browser's own bidi
  // algorithm, text selection, scrollbar side and form-control mirroring, none of which a class can
  // reach. Every logical utility in the app (ps-, me-, start-, end-) resolves off this one attribute.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', direction);
    root.setAttribute('lang', locale);
  }, [direction, locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // A browser that refuses storage still gets the language for this session.
    }
  }, []);

  const value = useMemo<I18nState>(
    () => ({ locale, direction, tag: LOCALE_TAGS[locale], setLocale }),
    [locale, direction, setLocale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}
