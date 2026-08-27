import { AlertTriangle, Coins } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common';
import { TimeAgo } from '@/components/common/time';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/ui';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useSetUsdtRate, useUsdtRate } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';
import {
  MONEY_STRING_REGEX,
  formatMinorToDecimal,
  groupDecimal,
  parseDecimalToMinor,
} from '@/lib/money';
import { USDT_SCALE } from '@/types';

import { railMessages } from './messages';

/**
 * What one USDT is worth, and the screen that stops that number being wrong by a factor of a
 * hundred.
 *
 * ── WHY THE WORKED EXAMPLE IS THE POINT OF THIS COMPONENT ─────────────────────────────────────
 * The server refuses a rate more than 20% from the one it replaces, which catches a misplaced
 * decimal and catches the Syrian redenomination confusion — the same site quotes both 132 and 13,200
 * for a dollar, and picking the wrong one credits every player a hundred times too much, straight
 * out of the operator's float.
 *
 * That guard cannot protect the FIRST rate. There is nothing to compare it against, and every rate
 * afterwards anchors to whatever the first one was. So the guard for the first one has to be a human
 * reading a sentence in their own units, before they press anything:
 *
 *     100 USDT  →  1,320,000.00 NSP
 *
 * A hundred-fold error is invisible in a rate and unmissable in a credit. This component's job is to
 * turn the first into the second.
 *
 * ── WHY IT LIVES ON /financial, AND ONLY THERE ────────────────────────────────────────────────
 * It used to sit at the bottom of the rails screen, on the argument that a rate belongs beside the
 * rails it prices. True, and not enough: the person who has to keep this number current went
 * looking for financial settings, found a screen called Payment rails, and concluded the setting
 * did not exist. It now sits under the words they used, beneath the wallet addresses it prices.
 *
 * It MOVED rather than being copied. This is a write form over one stored value, and a second copy
 * of it is a second place to read a stale number off — with no way to tell which screen last saved.
 *
 * ── WHY THE PREVIEW IS COMPUTED FROM THE TYPED TEXT ───────────────────────────────────────────
 * Not from the saved rate, and not after a round trip. It updates as the operator types, so the
 * example they read is the rate they are about to save rather than the one already in force — which
 * is the only version of this that can catch anything.
 */

/** The amounts the preview shows. Round numbers a person can check against their own arithmetic. */
const PREVIEW_AMOUNTS = [100, 10, 1] as const;

/**
 * `currency` comes from the caller, not from the saved rate.
 *
 * The rate row knows its own currency, but there is no rate row the first time somebody opens
 * this — and the first rate is precisely the one the worked example has to protect, because the
 * server jump guard cannot. An example that read "100 USDT → 1,320,000.00" with no units is a
 * weaker sentence than one that names them, on the single occasion it matters most.
 */
export function UsdtRatePanel({ currency }: { currency: string | null }) {
  return (
    <Can capability="paymentMethods.read">
      <RatePanelBody currency={currency} />
    </Can>
  );
}

function RatePanelBody({ currency }: { currency: string | null }) {
  const t = useT(railMessages);
  const { can } = useAuth();
  const rate = useUsdtRate();
  const save = useSetUsdtRate();

  const mayWrite = can('paymentMethods.write');
  /**
   * `null` means untouched; `''` means the operator cleared the field.
   *
   * They were the same value once, and the bug that produced was quiet and total: the field fell
   * back to the saved rate whenever the draft was empty, so clearing it put the old rate
   * straight back and anything typed next was appended to it. The rate could not be edited at
   * all, and the only symptom was a Save button that stayed disabled.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState('');
  /** Set only after the server refuses a large jump, so confirming is always a second act. */
  const [largeChange, setLargeChange] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const current = rate.data ?? null;
  // The field starts on the saved rate so a small correction is an edit, not a retype.
  const value = draft ?? current?.rate ?? '';
  const preview = previewFor(value);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (save.isPending || preview === null) return;

    setError(null);
    save.mutate(
      {
        rate: value,
        ...(note.trim().length === 0 ? {} : { sourceNote: note.trim() }),
        ...(largeChange === value ? { confirmLargeChange: true } : {}),
      },
      {
        onSuccess: () => {
          setDraft(null);
          setLargeChange(null);
          toast.success(t('rails.rate.saved'));
        },
        onError: (caught) => {
          // Not a failure to report and stop at: the server is asking whether the operator meant it.
          if (isApiError(caught) && caught.code === 'RATE_IMPLAUSIBLE_JUMP') {
            setLargeChange(value);
            return;
          }
          setError(caught);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="size-4 text-[var(--muted-foreground)]" />
          {t('rails.rate.title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">{t('rails.rate.description')}</p>

        {current === null ? (
          <Alert tone="warning" title={t('rails.rate.noneTitle')}>
            {t('rails.rate.noneBody')}
          </Alert>
        ) : current.isStale ? (
          <Alert tone="danger" title={t('rails.rate.staleTitle')}>
            {t('rails.rate.staleBody', { hours: current.maxAgeHours })}
          </Alert>
        ) : (
          <p className="text-sm">
            {t('rails.rate.setLabel')} <TimeAgo value={current.effectiveFrom} />
            {current.sourceNote === null ? null : (
              <>
                {' — '}
                <span className="text-[var(--muted-foreground)]">{current.sourceNote}</span>
              </>
            )}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="usdt-rate">{t('rails.rate.field')}</Label>
            <Input
              id="usdt-rate"
              value={value}
              onChange={(event) => {
                setDraft(event.target.value);
                // Any edit invalidates a confirmation given for a different number.
                setLargeChange(null);
                setError(null);
              }}
              disabled={!mayWrite}
              inputMode="decimal"
              autoComplete="off"
              // A rate is Latin digits in both languages, like every other amount on this screen.
              dir="ltr"
              className="font-mono"
              aria-invalid={preview === null && value.length > 0}
              aria-describedby="usdt-rate-preview"
            />
          </div>

          <RatePreview preview={preview} currency={current?.currencyCode ?? currency ?? ''} t={t} />

          {mayWrite ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="usdt-rate-note">{t('rails.rate.noteField')}</Label>
                <Input
                  id="usdt-rate-note"
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                  placeholder="sp-today.com"
                  maxLength={200}
                />
                <p className="text-xs text-[var(--muted-foreground)]">{t('rails.rate.noteHint')}</p>
              </div>

              {largeChange === null ? null : (
                <Alert tone="warning" title={t('rails.rate.jumpTitle')}>
                  {t('rails.rate.jumpBody')}
                </Alert>
              )}

              {error === null ? null : (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {errorMessage(error)}
                </p>
              )}

              <Button
                type="submit"
                variant={largeChange === null ? 'primary' : 'danger'}
                loading={save.isPending}
                disabled={preview === null}
              >
                {largeChange === null ? t('rails.rate.submit') : t('rails.rate.submitConfirm')}
              </Button>
            </>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">{t('rails.rate.readOnly')}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

interface Preview {
  rows: { usdt: number; credited: string }[];
}

/**
 * What each round amount of USDT would credit, at the rate currently typed.
 *
 * Returns null for anything that is not a rate, which is also what disables the button — a preview
 * that fell back to zero would read as "this credits nothing" rather than "this is not a number".
 */
function previewFor(value: string): Preview | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !MONEY_STRING_REGEX.test(trimmed) || trimmed.startsWith('-')) {
    return null;
  }

  let rateMinor: bigint;
  try {
    rateMinor = parseDecimalToMinor(trimmed);
  } catch {
    return null;
  }
  if (rateMinor <= 0n) return null;

  const unit = 10n ** BigInt(USDT_SCALE);
  return {
    rows: PREVIEW_AMOUNTS.map((usdt) => ({
      usdt,
      // The SAME arithmetic the server prices with, including the floor. A preview that rounded
      // differently would be a preview of a credit nobody is going to receive.
      credited: groupDecimal(formatMinorToDecimal((BigInt(usdt) * unit * rateMinor) / unit)),
    })),
  };
}

function RatePreview({
  preview,
  currency,
  t,
}: {
  preview: Preview | null;
  currency: string;
  t: ReturnType<typeof useT<(typeof railMessages)['en']>>;
}) {
  if (preview === null) {
    return (
      <p id="usdt-rate-preview" className="text-sm text-[var(--muted-foreground)]">
        {t('rails.rate.previewEmpty')}
      </p>
    );
  }

  return (
    <div
      id="usdt-rate-preview"
      className="space-y-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3"
    >
      <p className="flex items-center gap-2 text-xs font-medium">
        <AlertTriangle className="size-3.5 shrink-0 text-[var(--warning)]" />
        {t('rails.rate.previewTitle')}
      </p>
      <ul className="space-y-0.5 font-mono text-sm" dir="ltr">
        {preview.rows.map((row) => (
          <li key={row.usdt}>
            {row.usdt} USDT → {row.credited} {currency}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--muted-foreground)]">{t('rails.rate.previewHint')}</p>
    </div>
  );
}
