import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { ar, enGB, type Locale as DateFnsLocale } from 'date-fns/locale';

import type { Locale } from './i18n/locales';

/**
 * Dates on screen.
 *
 * A cashier console is read while something is going wrong, so the two questions are always "when
 * exactly" and "how long ago". Every timestamp is rendered as the relative form with the absolute
 * form in the tooltip — never one without the other.
 *
 * ── ON ARABIC ─────────────────────────────────────────────────────────────────────────────────
 * Month names and the relative phrasing come from date-fns' `ar` locale, so "3 minutes ago" reads
 * as «منذ ٣ دقائق» with correct agreement. DIGITS STAY WESTERN even there: this screen is read
 * beside a bank app and the Ichancy panel, both of which show 1,500.00, and a reviewer comparing two
 * figures must never have to transliterate between numeral systems. `padDigits` below is what keeps
 * the countdown consistent with that rule.
 */

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enGB, ar };

const dateLocale = (locale: Locale | undefined): DateFnsLocale => DATE_FNS_LOCALES[locale ?? 'en'];

export function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

/** `21 Aug 2026, 16:42` — unambiguous in both languages. */
export function formatDateTime(value: string | Date | null | undefined, locale?: Locale): string {
  const date = toDate(value);
  return date === null ? '—' : format(date, 'd MMM yyyy, HH:mm', { locale: dateLocale(locale) });
}

export function formatDateTimeSeconds(
  value: string | Date | null | undefined,
  locale?: Locale,
): string {
  const date = toDate(value);
  return date === null ? '—' : format(date, 'd MMM yyyy, HH:mm:ss', { locale: dateLocale(locale) });
}

export function formatDate(value: string | Date | null | undefined, locale?: Locale): string {
  const date = toDate(value);
  return date === null ? '—' : format(date, 'd MMM yyyy', { locale: dateLocale(locale) });
}

/** `3 minutes ago` / `منذ ٣ دقائق`, `in 12 minutes` / `خلال ١٢ دقيقة`. */
export function formatRelative(value: string | Date | null | undefined, locale?: Locale): string {
  const date = toDate(value);
  if (date === null) return '—';
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: dateLocale(locale) });
}

/**
 * Compact countdown for claim locks and token expiry: `4m 12s`, `2h 05m`, `expired`.
 *
 * Deliberately NOT localised into words. It ticks every second and sits in a badge a few characters
 * wide; a translated phrase would resize on every tick and push the row around. The unit letters are
 * the one place this console stays English in Arabic, and they are read as symbols, like `kg`.
 */
export function formatCountdown(
  target: string | Date | null | undefined,
  now = Date.now(),
  expiredLabel = 'expired',
): string {
  const date = toDate(target);
  if (date === null) return '—';
  const ms = date.getTime() - now;
  if (ms <= 0) return expiredLabel;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

/** How stale is this, in whole minutes. Drives the "waiting too long" colouring in the queue. */
export function minutesSince(
  value: string | Date | null | undefined,
  now = Date.now(),
): number | null {
  const date = toDate(value);
  if (date === null) return null;
  return Math.floor((now - date.getTime()) / 60_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Percentage from basis points, the unit the payment-method fee uses. */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** Grouped count. Western digits in both languages — see the module header. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
