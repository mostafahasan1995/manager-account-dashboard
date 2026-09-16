import { z } from 'zod';

import { isoDateTime } from './api';
import { shamCashBalanceSchema } from './shamcash';

/**
 * The Sham Cash DEVELOPER BENCH — the old browser mechanism, on demand, storing nothing.
 *
 * ══ WHY IT EXISTS ALONGSIDE `shamcash.ts` ═════════════════════════════════════════════════════
 * `shamcash.ts` is the LIVE path: an API key stored against the operator, read over HTTP. This is
 * the mechanism that preceded it — a headless browser replaying a signed-in session — and it is
 * kept for the two questions only a browser can answer when Sham Cash changes underneath us:
 *
 *   1. Are these session values still valid?     → `browser-check`, ~55-90 seconds, real Chromium.
 *   2. Does our parser still recognise the page? → `parse`, instant, no browser and no network.
 *
 * From outside, a failed read looks the same whether the credentials were refused or the site was
 * redesigned. Those have completely different fixes, and the second endpoint is what tells them
 * apart without waiting for a 90-second failure.
 *
 * ══ NOTHING HERE IS STORED ════════════════════════════════════════════════════════════════════
 * The five values travel in one request body and are dropped with it. There is no column to keep
 * them in — the migration that finished the API move removed it — so this console must never offer
 * to "save" them, and the form deliberately has no such button.
 */

/*
 * A currency card is the SAME shape whichever mechanism read it — currency, available, locked, all
 * strings — so the live schema is reused rather than a second one declared beside it. Two identical
 * schemas for one concept is how a field gets added to one and not the other.
 */

/**
 * One line of the transfer list, as rendered.
 *
 * Every field is the site's own STRING, kept verbatim: the date is not reformatted and the amount
 * is not parsed into a number, because on this screen they are evidence of what Sham Cash showed,
 * not values to compute with.
 */
export const shamCashTransactionSchema = z.looseObject({
  /** The operation number, without its leading `#`. */
  transactionId: z.string(),
  /** Exactly as rendered, e.g. `2026-08-26 - 16:10:31`. */
  date: z.string(),
  amount: z.string(),
  currency: z.string(),
  /** `in` for a received amount, `out` for a sent one. */
  direction: z.string(),
  username: z.string(),
  /** The masked card the counterparty used, e.g. `**** **** **** 0824`. */
  maskedCard: z.string(),
});
export type ShamCashDevTransaction = z.infer<typeof shamCashTransactionSchema>;

/** What `parse` answers: the parser's view of the page text you pasted. */
export const shamCashHomeSchema = z.looseObject({
  balances: z.array(shamCashBalanceSchema),
  transactions: z.array(shamCashTransactionSchema),
});
export type ShamCashHome = z.infer<typeof shamCashHomeSchema>;

/**
 * What `browser-check` answers.
 *
 * ══ `expired` IS A SUCCESS, NOT AN ERROR ══════════════════════════════════════════════════════
 * "Your cookies are stale" is the ANSWER to the question the bench was asked, so it arrives as a
 * 200 with this status rather than a 4xx. A screen that rendered it as a failure would look broken
 * at the exact moment it worked.
 *
 * `unavailable` carries a `debug` block for the one failure that cannot be diagnosed from a
 * message: the page loaded, was not redirected to login, and still did not look like the account
 * home. The DOM, the localStorage keys the app wrote and the site's own API responses are what tell
 * "we were blocked", "it is still loading" and "they redesigned it" apart.
 */
export const shamCashDevResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    balances: z.array(shamCashBalanceSchema),
    transactions: z.array(shamCashTransactionSchema),
    checkedAt: isoDateTime,
  }),
  z.object({ status: z.literal('expired') }),
  /* The reader can no longer return this — the cookies are an argument now — but the contract still
   * carries it, and an older API that does return it must render rather than fail validation. */
  z.object({ status: z.literal('not_linked') }),
  z.object({
    status: z.literal('unavailable'),
    detail: z.string(),
    debug: z
      .looseObject({
        url: z.string(),
        textSnippet: z.string(),
        htmlSnippet: z.string(),
        storageKeys: z.array(z.string()),
        errors: z.array(z.string()),
        api: z.array(z.looseObject({ path: z.string(), status: z.number() })),
      })
      .optional(),
  }),
]);
export type ShamCashDevResult = z.infer<typeof shamCashDevResultSchema>;

/** The five values, copied out of a signed-in shamcash.sy tab. */
export interface ShamCashBrowserCheckBody {
  accessToken: string;
  authToken: string;
  forge?: string;
  pinCodeHash?: string;
  pin?: string;
}

export interface ShamCashParseBody {
  text: string;
}

/**
 * Starting a QR login.
 *
 * The PIN is the code to SET on the browser being linked, not one to enter: Sham Cash asks a newly
 * linked device to choose one, and only writes `shamcash-pin-code-hash` once it is saved. Supplying
 * it up front is what makes the linked session complete rather than one that renders a blank page.
 */
export interface StartShamCashPairingBody {
  pin?: string;
}

/**
 * LINKING BY QR — the flow the site's own web client uses.
 *
 * The API opens a real browser on shamcash.sy's login page, hands back a picture of the QR it drew,
 * and keeps that browser open. You scan it from the phone app; the page signs ITSELF in, exactly as
 * it would on a desktop, and the cookies appear in that browser where they can be read out.
 *
 * ══ THE SESSION IS HANDED OVER EXACTLY ONCE ═══════════════════════════════════════════════════
 * A successful poll closes the browser and drops the pairing, so polling the same id again answers
 * `expired`. These are live credentials; an endpoint that would replay them on demand is a worse
 * thing to leave running than one that will not.
 */
export const shamCashPairingStartedSchema = z.looseObject({
  pairingId: z.string(),
  /** `data:image/png;base64,…` — the QR as the site drew it. */
  qrImage: z.string(),
  /**
   * WHICH selector found it, or `page` for the whole-page fallback.
   *
   * Shown on screen rather than hidden: the selector list was written without being able to reach
   * shamcash.sy, so `page` means "we could not find the QR element and this is the whole screen".
   * That is still usable — the code is somewhere in the picture — and it is the signal that one
   * line of the backend wants tuning.
   */
  strategy: z.string(),
  pageUrl: z.string(),
  expiresAt: isoDateTime,
  /** The login page's HTML, sent ONLY when the fallback was used, so the selector can be fixed. */
  pageHtml: z.string().optional(),
});
export type ShamCashPairingStarted = z.infer<typeof shamCashPairingStartedSchema>;

export const shamCashPairingPollSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending'), expiresAt: isoDateTime }),
  z.object({
    status: z.literal('linked'),
    session: z.looseObject({
      accessToken: z.string(),
      authToken: z.string(),
      forge: z.string().optional(),
      pinCodeHash: z.string().optional(),
    }),
    /** The app asked for the 4-digit PIN. The session is linked either way — see the backend. */
    pinRequired: z.boolean(),
  }),
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('failed'), detail: z.string() }),
]);
export type ShamCashPairingPoll = z.infer<typeof shamCashPairingPollSchema>;

/**
 * THE LINKED ACCOUNT — read on demand, from a browser the API keeps signed in.
 *
 * ══ WHY THE SNAPSHOT CAN BE STALE, AND WHY THAT IS RIGHT ══════════════════════════════════════
 * `GET /account` answers from the API's last read and touches no browser, so every open console can
 * call it for free. The figures come with `checkedAt` because a cached number without an age is a
 * claim about now — the screen shows the age and leaves the decision to refresh with the reader.
 *
 * A snapshot survives its session: `linked: false` with a snapshot means "the browser closed, and
 * these were the numbers when it did". That is worth more than an empty screen.
 */
export const accountSnapshotSchema = z.looseObject({
  balances: z.array(shamCashBalanceSchema),
  transactions: z.array(shamCashTransactionSchema),
  checkedAt: isoDateTime,
});
export type ShamCashAccountSnapshot = z.infer<typeof accountSnapshotSchema>;

export const accountStatusSchema = z.looseObject({
  /** Whether a signed-in browser is being held right now. */
  linked: z.boolean(),
  snapshot: accountSnapshotSchema.nullable(),
});
export type ShamCashAccountStatus = z.infer<typeof accountStatusSchema>;
