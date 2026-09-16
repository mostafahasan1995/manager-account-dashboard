import { isApiError } from '@/lib/api/errors';

import type { telegramMessages } from './messages';

type Translate = (
  key: keyof (typeof telegramMessages)['en'],
  values?: Record<string, string | number>,
) => string;

/**
 * The machine reasons the server sends beside a refusal, and which this console has a sentence for.
 *
 * Kept as an explicit list rather than interpolating the reason into a message key, so a reason the
 * console does not know about cannot produce a missing-key crash — it falls through to the server's
 * own `message`, which is in English but true. A new reason on the server therefore degrades to
 * "less well translated", never to "blank alert".
 */
const KNOWN_REASONS = [
  'INVALID_URL',
  'NOT_FOUND',
  'PRIVATE_CHAT',
  'BOT_NOT_MEMBER',
  'BOT_NOT_ADMIN',
  'BOT_CANNOT_POST',
  'DUPLICATE',
  'SEND_FAILED',
  'UNDELIVERABLE',
] as const;

type KnownReason = (typeof KNOWN_REASONS)[number];

function isKnownReason(value: unknown): value is KnownReason {
  return typeof value === 'string' && (KNOWN_REASONS as readonly string[]).includes(value);
}

/**
 * Pull the `reason` out of a failure and turn it into the sentence that names who fixes it.
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────────────────────────
 * "The bot is not in that group", "the bot is not an administrator" and "the bot may not post in
 * that channel" are three different jobs for three different people, and from the outside all three
 * look the same: nothing arrives. Rendering them as one error is what made a mis-bound chat so
 * expensive to diagnose that this whole feature was written. So the reason is carried machine-
 * readable from the server and translated here, rather than the server sending prose the console
 * cannot localise.
 *
 * Returns null when there is no reason to speak of, so the caller falls back to `errorMessage`.
 */
export function failureSentence(error: unknown, t: Translate): string | null {
  const reason = reasonOf(error);
  if (reason === null) return null;
  return t(`telegram.reason.${reason}` as 'telegram.reason.INVALID_URL');
}

/** The machine reason, when the failure carries one this console knows. */
export function reasonOf(error: unknown): KnownReason | null {
  if (!isApiError(error)) return null;

  // The server nests it under the Nest exception body, which the client surfaces as `details`.
  const details: unknown = error.details;
  if (typeof details === 'object' && details !== null && 'reason' in details) {
    const { reason } = details as { reason?: unknown };
    if (isKnownReason(reason)) return reason;
  }

  return null;
}

/** Turn a check/test result's `reason` field into a sentence, the same way. */
export function checkReasonSentence(reason: string | null, t: Translate): string | null {
  if (!isKnownReason(reason)) return null;
  return t(`telegram.reason.${reason}` as 'telegram.reason.INVALID_URL');
}
