import { z } from 'zod';

import { isoDateTime } from './api';

/**
 * WHERE AN OPERATOR'S BOT PUBLISHES — the groups and channels they configure themselves.
 *
 * ══ WHY chatId IS A STRING ════════════════════════════════════════════════════════════════════
 * A Telegram chat id is a signed 64-bit integer, and a channel id such as `-1001234567890` is past
 * what a JS `number` holds exactly. It crosses the wire as a decimal string for the same reason
 * money does, and it stays a string here: the console never does arithmetic on it, it only shows it
 * and passes it back.
 *
 * ══ WHY THERE IS NO BOT TOKEN IN THIS FILE ════════════════════════════════════════════════════
 * There is nowhere to put one and nothing to put in it. The operator's bot is registered against
 * their tenant on the server; the server loads it from the session. The console never sends a token
 * (so it cannot be pointed at somebody else's bot) and never receives one (so it cannot leak one).
 * If a field for one ever appears here, something has gone wrong upstream.
 */

/**
 * The event vocabulary, mirrored from the backend's `notification_category` enum.
 *
 * NOT EVERY VALUE HAS A PRODUCER YET, and the console says so rather than pretending: `PROFIT`,
 * the Sham Cash and USDT pairs, and `PLAYER_STATUS_CHANGE` are declared on both sides so a
 * destination can subscribe to them, and stay silent until the business event that feeds them
 * exists. Subscribing to one is not an error; it just receives nothing for now.
 */
export const NOTIFICATION_CATEGORIES = [
  'NEW_PLAYER',
  'DEPOSIT',
  'WITHDRAWAL',
  'PROFIT',
  'SHAM_CASH_DEPOSIT',
  'SHAM_CASH_WITHDRAWAL',
  'USDT_DEPOSIT',
  'USDT_WITHDRAWAL',
  'PLAYER_STATUS_CHANGE',
  'REPORT',
  'SYSTEM_ALERT',
] as const;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

/** Which categories actually have something publishing them today. */
export const LIVE_CATEGORIES: readonly NotificationCategory[] = [
  'NEW_PLAYER',
  'DEPOSIT',
  'WITHDRAWAL',
  'REPORT',
  'SYSTEM_ALERT',
];

export const telegramChatTypeSchema = z.enum(['GROUP', 'SUPERGROUP', 'CHANNEL']);
export type TelegramChatType = z.infer<typeof telegramChatTypeSchema>;

/**
 * THE BOT'S OWN MEMBERSHIP IN A CHAT, mirrored from the backend's `telegram_bot_chat_status` enum.
 *
 * Telegram's own vocabulary, kept rather than collapsed into a boolean, because the console prints a
 * DIFFERENT sentence for each: a bot that was kicked needs re-adding, a bot that is only a member
 * needs promoting, and a restricted bot needs a group setting changed. One flag would put all three
 * back into "it does not work".
 */
export const TELEGRAM_BOT_CHAT_STATUSES = [
  'CREATOR',
  'ADMINISTRATOR',
  'MEMBER',
  'RESTRICTED',
  'LEFT',
  'KICKED',
] as const;

export const telegramBotChatStatusSchema = z.enum(TELEGRAM_BOT_CHAT_STATUSES);
export type TelegramBotChatStatus = z.infer<typeof telegramBotChatStatusSchema>;

/**
 * A CHAT THE BOT HAS BEEN ADDED TO — the pick-list, and the only way a PRIVATE group is bindable.
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────────────────────────
 * Binding resolves what the operator pasted, which needs a handle Telegram can look up: an
 * @username, or a chat id. A public group has a username. A private group has neither — its only
 * shareable handle is an invite link, and a bot can neither follow one nor resolve one. There is
 * also no API that lists a bot's chats. So the operator met a dead end: add the bot, paste the only
 * link the group has, and be told the link cannot be used.
 *
 * The server now keeps what Telegram volunteers when the bot is added to a chat, and this is that
 * list. Picking a row fills the group field with its `chatId` — a value the resolver DOES accept,
 * and which it still verifies against Telegram before anything is saved. Nothing here is a shortcut
 * past that check; it is a shortcut past a number a human has no other way to find.
 *
 * ── WHY THE FLAGS ARE SEPARATE, AND WHY NONE OF THEM DISABLES A ROW ───────────────────────────
 * `isPresent`, `isAdministrator`, `canPost` and `alreadyBound` are four different situations with
 * four different next actions. They are also a SNAPSHOT of the last time Telegram told us anything,
 * which is exactly why they annotate rather than block: an operator who promoted the bot a minute
 * ago would otherwise be locked out of a group that now works perfectly. The server decides.
 */
export const discoveredChatSchema = z.object({
  /** Signed 64-bit, as a decimal string — and the value that makes a private group bindable. */
  chatId: z.string(),
  chatType: telegramChatTypeSchema,
  title: z.string().nullable(),
  /** Null for a private group, which is the case this list exists for. */
  username: z.string().nullable(),
  status: telegramBotChatStatusSchema,
  isAdministrator: z.boolean(),
  /** False once the bot left or was removed. Those rows are shown, not hidden — see the header. */
  isPresent: z.boolean(),
  canPost: z.boolean(),
  /** Already an active destination, so the console says so instead of letting it be added twice. */
  alreadyBound: z.boolean(),
  firstSeenAt: isoDateTime,
  lastSeenAt: isoDateTime,
});
export type DiscoveredChat = z.infer<typeof discoveredChatSchema>;

export const telegramDestinationSchema = z.object({
  id: z.string(),
  /** Signed 64-bit, as a decimal string. See the header. */
  chatId: z.string(),
  chatType: telegramChatTypeSchema,
  /** What the operator originally pasted. Null on rows bound before this was recorded. */
  telegramUrl: z.string().nullable(),
  /** The group's real Telegram title, as the server last read it from getChat. */
  title: z.string().nullable(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  categories: z.array(notificationCategorySchema),
  isActive: z.boolean(),
  /**
   * Null means "never verified since it was bound" — its own state, rendered as such, never as an
   * error and never as an empty cell.
   */
  lastVerifiedAt: isoDateTime.nullable(),
  /** Telegram's own words on the last failure. Null once a later attempt succeeded. */
  lastError: z.string().nullable(),
  lastPublishedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type TelegramDestination = z.infer<typeof telegramDestinationSchema>;

/**
 * The answer to "can this bot actually post here, right now".
 *
 * THREE SEPARATE BOOLEANS, and the console renders them as three separate indicators, because they
 * fail separately and a different person fixes each: a missing bot needs someone to add it, a
 * non-administrator needs a group admin to promote it, and a channel administrator without the post
 * right needs a permission toggled. Collapsing them into one tick is what made the old, silent
 * binding so expensive to debug.
 */
export const telegramDestinationCheckSchema = z.object({
  ok: z.boolean(),
  isMember: z.boolean(),
  isAdministrator: z.boolean(),
  canPost: z.boolean(),
  /** Machine-readable reason when `ok` is false, for a localised sentence. Null on success. */
  reason: z.string().nullable(),
  /** Telegram's own words, when it gave any. Never a paraphrase. */
  detail: z.string().nullable(),
  title: z.string().nullable(),
  /** True only when a real message was posted (the test route, not the dry check). */
  messageSent: z.boolean(),
});
export type TelegramDestinationCheck = z.infer<typeof telegramDestinationCheckSchema>;

/**
 * The result of publishing a report.
 *
 * `considered: 0` is a legitimate answer, not a failure: it means no destination subscribes to
 * REPORT, and the screen says exactly that rather than reporting a successful send of nothing.
 */
export const publishReportResultSchema = z.object({
  title: z.string(),
  considered: z.number(),
  delivered: z.number(),
  failed: z.number(),
});
export type PublishReportResult = z.infer<typeof publishReportResultSchema>;

/** Note the absence of a chatId: the server resolves the URL, so a client cannot assert an id. */
export interface CreateTelegramDestinationBody {
  url: string;
  displayName?: string;
  categories: NotificationCategory[];
  isActive?: boolean;
}

/** No `url`: repointing a destination at a different chat is a remove plus an add, not an edit. */
export interface UpdateTelegramDestinationBody {
  displayName?: string;
  categories?: NotificationCategory[];
  isActive?: boolean;
}

export interface PublishReportBody {
  period?: 'day' | 'week' | 'month';
}
