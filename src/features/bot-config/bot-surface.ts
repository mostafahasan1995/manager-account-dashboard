import type { PaymentMethod } from '@/types';

/**
 * WHAT THE BOT SHOWS A PLAYER — mirrored from the bot's own constants.
 *
 * ══ WHY THE ARABIC IN THIS FILE IS NOT IN messages.ts ═════════════════════════════════════════
 * Every user-visible string in this console goes through `defineMessages`. These are not console
 * strings: they are the BOT'S OWN TEXT, quoted. Translating a quotation would make the screen
 * report something the bot does not say — the same reason a destination's `lastError` is rendered
 * in Telegram's own words and never paraphrased. They read identically on the Arabic console and
 * on the English one, because the bot reads identically to an Arabic player and an English one:
 * `translatorFrom` ignores the locale it is handed and answers everybody in Arabic. The deposit
 * notifications are the exception — a switch that never sees a locale at all, generating English —
 * and they are quoted here in the English they are generated in.
 *
 * ══ THIS IS A COPY, AND THE SCREEN SAYS SO ════════════════════════════════════════════════════
 * There is no endpoint that returns the bot's menu, its main keyboard or its message bundle. So
 * these are transcribed from the API repo — `core/telegram/bot-menu.constants.ts` and
 * `modules/player/telegram/player.handlers.ts` — and a change on that side leaves this stale
 * without anything failing. That is exactly why the command list is presented as a READING of the
 * bot rather than as a form: a copy can go out of date, and a form over a copy would be wrong in a
 * second way as well. The screen carries that caveat in words; this note is here so the next person
 * to touch the file knows the caveat is deliberate rather than an oversight.
 */

// ── The command menu ───────────────────────────────────────────────────────────────────────────

/**
 * Who is shown a command. The staff extras are pushed ONLY to chat-scoped menus — the admin group
 * and each admin's private chat — never to the default scope, because the admin handlers answer a
 * non-admin with silence precisely so that the staff surface cannot be enumerated.
 */
export type BotCommandAudience = 'PLAYER' | 'ADMIN';

export interface BotCommandRow {
  readonly command: string;
  /** The description Telegram is given, exactly as it is pushed. Quoted, never translated. */
  readonly description: string;
  readonly audience: BotCommandAudience;
}

/** `PLAYER_COMMANDS` then `ADMIN_EXTRA_COMMANDS`, in the order the bot pushes them. */
export const BOT_COMMANDS: readonly BotCommandRow[] = [
  { command: 'start', description: '🚀 بدء واستخدام البوت', audience: 'PLAYER' },
  { command: 'help', description: 'ℹ️ القائمة والمساعدة', audience: 'PLAYER' },
  { command: 'deposit', description: '💰 شحن الرصيد', audience: 'PLAYER' },
  { command: 'methods', description: '💳 طرق الدفع', audience: 'PLAYER' },
  { command: 'deposits', description: '🧾 إيداعاتي', audience: 'PLAYER' },
  { command: 'balance', description: '💵 رصيدي', audience: 'PLAYER' },
  { command: 'profile', description: '👤 حسابي وبيانات الدخول', audience: 'PLAYER' },
  { command: 'about', description: '✅ حالة الخدمة', audience: 'PLAYER' },
  { command: 'terms', description: '📄 الشروط', audience: 'PLAYER' },
  { command: 'paysupport', description: '🆘 مشكلة بالدفع', audience: 'PLAYER' },
  { command: 'queue', description: '📥 الطابور', audience: 'ADMIN' },
  { command: 'report', description: '📊 تقرير النشاط', audience: 'ADMIN' },
  { command: 'float', description: '🏦 رصيد الكاشيرة', audience: 'ADMIN' },
  { command: 'breaks', description: '⚠️ مشاكل التسوية', audience: 'ADMIN' },
  { command: 'register', description: '🆕 إنشاء حساب لاعب', audience: 'ADMIN' },
];

// ── The /start menu ────────────────────────────────────────────────────────────────────────────

/**
 * The eight buttons of the bot's docked keyboard — the one that sits under the text box rather than
 * on a message. Built once at module load in the bot and read from no table, so every operator's
 * menu is these same eight in this same order.
 *
 * A HAND-COPY of PLAYER_MENU_ROWS in the API's src/core/telegram/bot-menu.constants.ts, and there is
 * no test that can catch it drifting: the two repositories never import from one another. Since the
 * bot moved to a reply keyboard these labels are also its ROUTING KEYS, so a label edited there and
 * not here leaves this preview quietly describing a menu that no longer exists.
 */
export const MAIN_MENU_BUTTONS: readonly string[] = [
  '💵 شحن الرصيد',
  '💰 رصيدي',
  '📄 إيداعاتي',
  '🏦 طرق الدفع',
  '👤 حسابي',
  '💬 الدعم',
  '📋 الشروط',
  '🟢 حالة الخدمة',
];

// ── The bot's profile ──────────────────────────────────────────────────────────────────────────

/** Interpolated into /start, /help and /about. A literal in the bot; no handler reads a tenant. */
export const BOT_NAME = 'Ichancy Cashier';

/** Shown on the empty chat screen, before a player taps Start. */
export const BOT_DESCRIPTION = [
  'شحن رصيدك في Ichancy بسهولة وأمان 💰',
  'ابدأ بالضغط على زر Start 👇',
  'جميع الإيداعات تُراجع من فريقنا قبل إضافة الرصيد ✅',
].join('\n');

/** The bio line on the bot's profile page. */
export const BOT_SHORT_DESCRIPTION = 'بوت شحن رصيد Ichancy — سريع وآمن ⚡';

/** Telegram's own caps on those two texts. */
export const BOT_DESCRIPTION_MAX = 512;
export const BOT_SHORT_DESCRIPTION_MAX = 120;

// ── The message surfaces this screen can point at ──────────────────────────────────────────────

/**
 * Strings in the PLAYER BOT'S OWN BUNDLE. One surface, not the bot's whole vocabulary — counted
 * rather than estimated, because the number is the argument: a screen offering "your bot's messages"
 * as one editable table would be showing this bundle and calling it all of them.
 *
 * It is not everything /deposit answers with either. The welcome is inline in its handler, the
 * account details the player reads next come from the payment method's own `instructions`, and the
 * notification that closes the deposit is the switch below. Nothing serves an inventory of the bot's
 * text over the API, so this is a count of one bundle and must never be printed as a total.
 */
export const INTERACTIVE_MESSAGE_COUNT = 104;

/**
 * The queued deposit notifications: a separate switch, in a separate file, answering in English.
 *
 * Five templates — credited, rejected, expired, failed-to-credit, proof-received. The count is
 * printed to an operator beside a card they can compare it against, so it is the number of templates
 * that exist rather than a round one.
 */
export const QUEUED_MESSAGE_COUNT = 5;

/**
 * The welcome, quoted. An inline literal in the handler — not even in the message bundle.
 *
 * These are the lines EVERY player is sent. The handler appends more in some cases, and those stay
 * out of this constant and are shown under a caption naming the condition: a conditional line pasted
 * silently into a quotation tells an operator their players read something most of them never do.
 */
export const QUOTED_WELCOME = [
  '👋 أهلاً وسهلاً!',
  '',
  `${BOT_NAME} — صرّافك هون: اشحن رصيد حسابك وتابع إيداعاتك مباشرة من التلغرام.`,
  '',
  'اختر من القائمة:',
].join('\n');

/**
 * The line the welcome carries ONLY for a player who arrived through a referral link, with the
 * handler's own placeholder left in. Dropping it hid text a referred player really reads; appending
 * it to `QUOTED_WELCOME` would have claimed every player reads it. So it is quoted separately and
 * captioned with its condition.
 */
export const QUOTED_WELCOME_REFERRAL = '🎁 تمت دعوتك عبر رمز الإحالة {referralCode}.';

/**
 * The credited notification, quoted AS A TEMPLATE — the bot's own placeholders rather than a
 * filled-in instance.
 *
 * A specimen reference number is the one thing on a console screen that cannot be read as an
 * illustration: an operator goes looking for deposit D-7F2A91, finds nothing, and now distrusts the
 * card. `{shortId}` reads as what it is. English, to a player who has read Arabic all the way here.
 */
export const QUOTED_CREDITED = [
  '✅ Your deposit {shortId} has been credited with {amount}.',
  'Enjoy your game!',
].join('\n');

/** The two lines above the payment keyboard, quoted, for the preview. */
export const QUOTED_CONFIRM_AMOUNT = 'أنت تشحن {amount} {currency}.';
export const QUOTED_CHOOSE_METHOD = 'اختر طريقة الدفع:';

/**
 * What the PLAYER types to open that keyboard. Quoted here rather than translated in the message
 * bundle because the bot accepts it in Latin only — a command sitting in `messages.ts` is a command
 * a translator eventually translates, and the bot then answers the translation with nothing.
 */
export const QUOTED_DEPOSIT_COMMAND = '/deposit {amount}';

// ── The 64-byte cap that can silently drop a button ────────────────────────────────────────────

/** Telegram's own limit on `callback_data`. Bytes, never characters. */
export const CALLBACK_DATA_MAX_BYTES = 64;

const DEPOSIT_CALLBACK_NAMESPACE = 'pdep';

/**
 * The hidden payload behind one payment button: namespace, method id, amount in minor units.
 *
 * THE LABEL IS NOT IN HERE, which is the whole reason the screen shows the number. An operator who
 * has been told that emoji break Telegram buttons will otherwise keep their buttons plain for a
 * reason that does not apply. What can overflow is the METHOD ID — a uuid nobody chose by hand.
 */
export function depositCallbackData(methodId: string, amountMinor: bigint): string {
  return `${DEPOSIT_CALLBACK_NAMESPACE}:${methodId}:${amountMinor.toString()}`;
}

/** UTF-8 bytes, mirroring the bot's `Buffer.byteLength(data, 'utf8')`. */
export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

// ── What the keyboard would look like ──────────────────────────────────────────────────────────

export interface PreviewButton {
  readonly method: PaymentMethod;
  readonly bytes: number;
  /** True when the payload is over the cap: the bot logs it and leaves the row out. */
  readonly dropped: boolean;
}

export interface KeyboardPreview {
  /** In the bot's own order: `sortOrder` ascending, then label — exactly how it queries them. */
  readonly buttons: readonly PreviewButton[];
  /** Offerable methods this amount falls outside. The bot answers with its limits instead. */
  readonly outOfRange: readonly PaymentMethod[];
  /**
   * Exactly one method takes the amount, so the bot asks nothing and opens the deposit. Decided
   * BEFORE the payload check, the way the handler decides it.
   */
  readonly skipsKeyboard: boolean;
}

/**
 * The bot's own running order: `sortOrder` ascending, ties alphabetical by label — exactly how it
 * queries them.
 *
 * Exported because the EDITABLE list has to be drawn in it too. A console that lists an operator's
 * buttons in whatever order the API returned, under a sentence saying "in this order", is telling
 * them a keyboard their players will not be shown.
 */
export function compareBotOrder(a: PaymentMethod, b: PaymentMethod): number {
  return a.sortOrder === b.sortOrder
    ? a.displayName.localeCompare(b.displayName)
    : a.sortOrder - b.sortOrder;
}

/**
 * The methods the bot would even consider, in its order.
 *
 * Mirrors `PlayerTelegramHandlers.activeMethodsFor`: active only, the player's own currency only,
 * INTERNAL excluded — that rail exists for corrections and float top-ups and has no instructions to
 * render, so offering it would produce a payment nobody can make.
 */
export function offerableMethods(
  methods: readonly PaymentMethod[],
  currency: string,
): PaymentMethod[] {
  return methods
    .filter(
      (method) => method.isActive && method.rail !== 'INTERNAL' && method.currencyCode === currency,
    )
    .sort(compareBotOrder);
}

/**
 * Which buttons the bot would draw for one amount.
 *
 * `minorOf` is injected rather than imported so this stays a pure mirror of the bot's arithmetic
 * over whatever the caller's money helper is, and so a test can drive it without a currency scale
 * argument threading through every call.
 */
export function previewKeyboard(
  methods: readonly PaymentMethod[],
  currency: string,
  amountMinor: bigint,
  minorOf: (decimal: string) => bigint,
): KeyboardPreview {
  const usable: PaymentMethod[] = [];
  const outOfRange: PaymentMethod[] = [];

  for (const method of offerableMethods(methods, currency)) {
    const withinRange =
      amountMinor >= minorOf(method.minAmount) && amountMinor <= minorOf(method.maxAmount);
    (withinRange ? usable : outOfRange).push(method);
  }

  const buttons = usable.map((method) => {
    const bytes = utf8Bytes(depositCallbackData(method.id, amountMinor));
    return { method, bytes, dropped: bytes > CALLBACK_DATA_MAX_BYTES };
  });

  return { buttons, outOfRange, skipsKeyboard: usable.length === 1 };
}
