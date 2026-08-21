import { createContext } from 'react';

import type { Direction, Locale } from './locales';

export interface I18nState {
  locale: Locale;
  direction: Direction;
  /** The BCP-47 tag for Intl and date-fns. */
  tag: string;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nState | null>(null);

export const LOCALE_STORAGE_KEY = 'cashier-console.locale.v1';
