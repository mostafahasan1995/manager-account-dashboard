import { errorMessage, isApiError } from '@/lib/api/errors';
import { useT } from '@/lib/i18n/use-translation';
import { TENANT_CHAT_REJECTION_REASONS, type TenantChatRejectionReason } from '@/types';

import { tenantMessages } from './messages';

/** The code every staff and feed group bind answers when Telegram says the chat cannot be used. */
export const TELEGRAM_CHAT_REJECTED = 'TELEGRAM_CHAT_REJECTED';

/**
 * The machine-readable reason inside a 400 TELEGRAM_CHAT_REJECTED, or null for anything else.
 *
 * Parsed rather than cast, and null rather than throwing on a shape it does not know: this reads an
 * ERROR body at the moment something already went wrong, and a reason added on the backend later
 * must fall back to the server's own sentence instead of blanking the refusal.
 */
export function chatRejectionReasonOf(error: unknown): TenantChatRejectionReason | null {
  if (!isApiError(error) || error.code !== TELEGRAM_CHAT_REJECTED) return null;
  const details = error.details;
  if (typeof details !== 'object' || details === null) return null;
  const reason = (details as { reason?: unknown }).reason;
  return TENANT_CHAT_REJECTION_REASONS.find((known) => known === reason) ?? null;
}

const REASON_KEYS = {
  NOT_FOUND: 'tenants.bind.reason.NOT_FOUND',
  PRIVATE_CHAT: 'tenants.bind.reason.PRIVATE_CHAT',
  CHANNEL_NOT_ALLOWED: 'tenants.bind.reason.CHANNEL_NOT_ALLOWED',
  BOT_NOT_MEMBER: 'tenants.bind.reason.BOT_NOT_MEMBER',
  BOT_NOT_ADMIN: 'tenants.bind.reason.BOT_NOT_ADMIN',
  BOT_CANNOT_POST: 'tenants.bind.reason.BOT_CANNOT_POST',
} as const satisfies Record<TenantChatRejectionReason, string>;

/**
 * Turns a failed bind into the sentence to show. A known Telegram refusal is said in the operator's
 * own language — the reason decides WHO fixes it (add the bot, promote it, pick a group instead of a
 * channel), which is the whole point of the backend sending six reasons instead of one. Anything else
 * is the API's own message, verbatim.
 */
export function useChatRejectionSentence(): (error: unknown) => string {
  const t = useT(tenantMessages);
  return (error) => {
    const reason = chatRejectionReasonOf(error);
    return reason === null ? errorMessage(error) : t(REASON_KEYS[reason]);
  };
}
