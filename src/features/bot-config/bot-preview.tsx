import { Bot } from 'lucide-react';

import { Alert, Input, Label } from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import { formatMinorToDecimal, groupDecimal, parseDecimalToMinor } from '@/lib/money';
import type { PaymentMethod } from '@/types';

import {
  BOT_NAME,
  QUOTED_CHOOSE_METHOD,
  QUOTED_CONFIRM_AMOUNT,
  QUOTED_DEPOSIT_COMMAND,
  previewKeyboard,
} from './bot-surface';
import { botConfigMessages } from './messages';

/**
 * The bot's payment keyboard, as a player would meet it.
 *
 * ── WHY A PREVIEW AND NOT A LIST OF LABELS ────────────────────────────────────────────────────
 * The labels are already visible in the editor beside this. What is NOT visible anywhere is the
 * gap between "I configured six methods" and "the player was shown two", and that gap is where
 * every support conversation about this feature starts. Four of the bot's own rules decide it:
 * active only, the player's currency only, the amount inside the method's own limits, and — the
 * one nobody expects — no keyboard at all when exactly one method qualifies, because a single
 * button is a tap that carries no information.
 *
 * So the amount is an input rather than a fixed number. Typing 5,000 and watching four buttons
 * become one is the fastest possible explanation of a rail that "does not show up", and it is
 * built from the operator's real methods rather than from an illustration.
 *
 * ── WHY THE BUBBLE IS ARABIC ON THE ENGLISH CONSOLE ───────────────────────────────────────────
 * Because the bot is. `translatorFrom` ignores the locale Telegram reports and answers everybody in
 * Arabic — a deliberate decision on the bot's side, after a Syrian player whose phone was set to
 * English received the entire bot in English. A preview that rendered this in the console's own
 * language would be showing a bot that does not exist. The caption says so out loud.
 *
 * It also names the exception, because the exception starts one tap after this screen ends: the
 * payment details `renderPlayerMessage` sends the instant a player picks one of these buttons are
 * generated in English, as are the deposit notifications. "The bot answers every player in Arabic"
 * on its own would be true of the bubble drawn here and false of the next message the player gets.
 */
export function BotPreview({
  methods,
  currency,
  amountText,
  onAmountChange,
}: {
  methods: readonly PaymentMethod[];
  /** Null when there is no active method at all, so there is no currency to preview in. */
  currency: string | null;
  /** Digits only — the panel sanitises, so this always parses. */
  amountText: string;
  onAmountChange: (value: string) => void;
}) {
  const t = useT(botConfigMessages);

  if (currency === null) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">{t('botConfig.preview.noCurrency')}</p>
    );
  }

  const amountMinor = amountText.length === 0 ? 0n : parseDecimalToMinor(amountText);
  const { buttons, outOfRange, skipsKeyboard } = previewKeyboard(
    methods,
    currency,
    amountMinor,
    (decimal) => parseDecimalToMinor(decimal),
  );
  const shown = buttons.filter((button) => !button.dropped);
  const amount = groupDecimal(formatMinorToDecimal(amountMinor));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="preview-amount">{t('botConfig.preview.amount')}</Label>
        <Input
          id="preview-amount"
          value={amountText}
          inputMode="numeric"
          autoComplete="off"
          className="max-w-40 tabular-nums"
          onChange={(event) => {
            onAmountChange(event.target.value);
          }}
        />
      </div>

      {/* A phone, not a diagram: the frame is what makes an operator read the contents as their
          player's screen rather than as one more panel of the console. */}
      <div className="mx-auto w-full max-w-xs rounded-3xl border-4 border-[var(--border-strong)] bg-[var(--surface-muted)] p-3">
        <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate text-xs font-medium">{BOT_NAME}</span>
        </div>

        <div className="space-y-2">
          {/* The player's own message, and the one string on this screen an operator retypes into
              Telegram. `dir="ltr"` so the leading slash stays in front of the word on the Arabic
              console; the text is the bot's, interpolated here rather than translated, because the
              bot answers `/deposit` and nothing else. */}
          <p
            dir="ltr"
            className="ms-auto w-fit max-w-[85%] rounded-2xl bg-[var(--primary)] px-3 py-1.5 text-start font-mono text-xs text-[var(--primary-foreground)]"
          >
            {QUOTED_DEPOSIT_COMMAND.replace('{amount}', amount)}
          </p>

          {skipsKeyboard ? (
            <p className="me-auto w-full rounded-2xl bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {t('botConfig.preview.single')}
            </p>
          ) : shown.length === 0 ? (
            <p className="me-auto w-full rounded-2xl bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {t('botConfig.preview.none')}
            </p>
          ) : (
            <>
              <div
                dir="rtl"
                lang="ar"
                className="me-auto w-full rounded-2xl bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <p>
                  {QUOTED_CONFIRM_AMOUNT.replace('{amount}', amount).replace(
                    '{currency}',
                    currency,
                  )}
                </p>
                <p>{QUOTED_CHOOSE_METHOD}</p>
              </div>
              <ul aria-label={t('botConfig.preview.title')} className="space-y-1.5">
                {shown.map((button) => (
                  <li
                    key={button.method.id}
                    className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-center text-xs font-medium break-words"
                  >
                    {button.method.displayName}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        {t('botConfig.preview.caption', { currency })}
      </p>
      <p className="text-xs text-[var(--muted-foreground)]">{t('botConfig.preview.arabic')}</p>

      {outOfRange.length === 0 ? null : (
        // Named rather than merely absent: "why is my rail not there" is the question this whole
        // panel exists to answer, and an empty space answers nothing.
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('botConfig.preview.outOfRange', {
            names: outOfRange.map((method) => method.displayName).join(', '),
          })}
        </p>
      )}

      {buttons.length === shown.length ? null : (
        <Alert tone="warning" title={t('botConfig.buttons.payloadOver')}>
          {buttons
            .filter((button) => button.dropped)
            .map((button) => button.method.displayName)
            .join(', ')}
        </Alert>
      )}
    </div>
  );
}
