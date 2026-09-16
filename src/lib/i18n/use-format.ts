import { useMemo } from 'react';

import { formatDate, formatDateTime, formatDateTimeSeconds, formatRelative } from '@/lib/format';

import { useI18n } from './use-translation';

/**
 * The date formatters, already bound to the current language.
 *
 * Components call `formatters.relative(value)` instead of threading the locale through every call
 * site — which is how half a screen ends up in English after a language switch.
 */
export function useFormatters() {
  const { locale } = useI18n();

  return useMemo(
    () => ({
      dateTime: (value: string | Date | null | undefined) => formatDateTime(value, locale),
      dateTimeSeconds: (value: string | Date | null | undefined) =>
        formatDateTimeSeconds(value, locale),
      date: (value: string | Date | null | undefined) => formatDate(value, locale),
      relative: (value: string | Date | null | undefined) => formatRelative(value, locale),
    }),
    [locale],
  );
}
