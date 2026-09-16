import { useCallback, useContext, useMemo } from 'react';

import { commonMessages } from './common-messages';
import { I18nContext, type I18nState } from './i18n-context';
import { translate, type Interpolations, type MessageBundle, type Messages } from './messages';

export function useI18n(): I18nState {
  const context = useContext(I18nContext);
  if (context === null) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return context;
}

/** Every key the shared bundle defines — available to every screen without declaring anything. */
export type CommonKey = keyof typeof commonMessages.en;

/** A screen's own keys, plus the shared ones. */
export type TranslatorKey<T extends Messages> = (keyof T & string) | CommonKey;

export type Translator<T extends Messages> = (
  key: TranslatorKey<T>,
  values?: Interpolations,
) => string;

/** With no bundle, only the shared keys exist — which is what the layout and the primitives need. */
export type CommonTranslator = (key: CommonKey, values?: Interpolations) => string;

/**
 * The translator a screen uses.
 *
 * `useT(messages)` types its keys to that feature's bundle AND falls through to the shared one, so
 * `t('deposits.queue.title')` and `t('common.cancel')` both work and both autocomplete.
 *
 * The two overloads are what makes that precise. A single signature with a defaulted generic would
 * widen `keyof T` to `string` in the no-bundle case, and `string | <literal union>` collapses to
 * `string` — losing the autocomplete and the typo check that are the whole point.
 */
export function useT(): CommonTranslator;
export function useT<T extends Messages>(bundle: MessageBundle<T>): Translator<T>;
export function useT<T extends Messages>(bundle?: MessageBundle<T>): Translator<T> {
  const { locale } = useI18n();

  const bundles = useMemo<readonly MessageBundle[]>(
    () => (bundle === undefined ? [commonMessages] : [bundle, commonMessages]),
    [bundle],
  );

  return useCallback(
    (key: TranslatorKey<T>, values?: Interpolations) => translate(bundles, locale, key, values),
    [bundles, locale],
  );
}

/**
 * Backend enum values, translated.
 *
 * `enumLabel('depositStatus', 'PENDING_SECOND_APPROVAL')` finds
 * `enum.depositStatus.PENDING_SECOND_APPROVAL`. A value the backend adds tomorrow has no key, so it
 * renders as itself humanised rather than vanishing — the same rule the badges already follow.
 */
export function useEnumLabel(): (group: string, value: string) => string {
  const { locale } = useI18n();

  return useCallback(
    (group: string, value: string) => {
      const key = `enum.${group}.${value}`;
      const translated = translate([commonMessages], locale, key);
      if (translated !== key) return translated;
      const lower = value.toLowerCase().replace(/_/g, ' ');
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    },
    [locale],
  );
}
