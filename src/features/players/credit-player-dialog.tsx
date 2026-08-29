import { useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';

import { DetailList, DetailRow, MoneyAmount } from '@/components/common';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/ui';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useCreditPlayer } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { formatMinorToDecimal, formatMoney, parseDecimalToMinor } from '@/lib/money';
import type { MoneyView } from '@/types/api';
import {
  CREDIT_REASON_MAX_LENGTH,
  playerDisplayName,
  type AdminPlayer,
  type ManualCredit,
} from '@/types/player';

import { playerMessages } from './messages';

/**
 * Giving a player points, recorded as a MANUAL DEPOSIT.
 *
 * ── WHY THIS IS GENTLER THAN THE DEBIT, AND WHERE IT IS NOT ────────────────────────────────────
 * A debit reaches into a live balance and removes from it, with no undo. A credit is the opposite
 * shape: nothing is taken from anyone, and the money does not even move here — this records an
 * already-approved deposit, and the SAME credit worker that finishes a real deposit tops the player
 * up seconds later, with its Ichancy verify-by-delta and float guard. So success is "queued", not
 * "done", and a large one is routed to a second approver rather than credited on the spot.
 *
 * It is still two steps and still refuses to auto-repeat: a 5xx may have queued a credit the console
 * cannot see the result of, and offering "try again" there would risk crediting twice — recoverable,
 * because it is our float that absorbs it, but not something to invite by accident.
 */
export function CreditPlayerDialog({
  player,
  open,
  onOpenChange,
  onCredited,
}: {
  player: AdminPlayer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCredited: (credit: ManualCredit) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every opening starts from an empty amount rather than from
            whatever the last one was — the same rule the debit form follows. */}
        <CreditForm
          player={player}
          onCancel={() => {
            onOpenChange(false);
          }}
          onCredited={onCredited}
        />
      </DialogContent>
    </Dialog>
  );
}

type Step = 'amount' | 'confirm';

function CreditForm({
  player,
  onCancel,
  onCredited,
}: {
  player: AdminPlayer;
  onCancel: () => void;
  onCredited: (credit: ManualCredit) => void;
}) {
  const t = useT(playerMessages);
  const mutation = useCreditPlayer();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const name = playerDisplayName(player);
  const typedAmount = amount.trim();
  const trimmedReason = reason.trim();

  // A bigint or nothing. The amount never becomes a JavaScript number on its way to the wire — an
  // NSP figure outruns what a double holds exactly, and a credit rounded by a float credits the
  // wrong amount.
  const minor = readMinor(typedAmount);

  const amountError =
    typedAmount.length === 0
      ? t('players.credit.amountRequired')
      : minor === null
        ? t('players.credit.amountFormat')
        : minor <= 0n
          ? t('players.credit.amountTooSmall')
          : null;

  const reasonError =
    trimmedReason.length === 0
      ? t('players.credit.reasonRequired')
      : trimmedReason.length > CREDIT_REASON_MAX_LENGTH
        ? t('players.credit.reasonTooLong', {
            max: CREDIT_REASON_MAX_LENGTH,
            length: trimmedReason.length,
          })
        : null;

  const money: MoneyView | null =
    minor === null || minor <= 0n
      ? null
      : {
          minor: minor.toString(),
          amount: formatMinorToDecimal(minor),
          currency: player.currencyCode,
        };

  const failure: unknown = mutation.error;

  /** Nothing moved on a 4xx, so the button may stay. See `provablyUntouched` at the foot of this file. */
  const mayTryAgain = failure == null || provablyUntouched(failure);

  const review = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (amountError !== null || reasonError !== null) return;
    setStep('confirm');
  };

  /**
   * Both endings are good news of different sizes: credited-soon, or waiting on a second approver.
   * The figure comes from the SERVER's response (`credit.amount`), not the client-typed `sent` — the
   * deposit is booked in the payment method's currency, which is the currency that actually moved, so
   * that is the one to report back (they coincide in a single-currency deployment).
   */
  const announce = (credit: ManualCredit) => {
    const moved = formatMoney(credit.amount);
    if (credit.status === 'PENDING_SECOND_APPROVAL') {
      toast.success(t('players.credit.secondApprovalTitle'), {
        description: t('players.credit.secondApprovalBody', { name, amount: moved }),
      });
      return;
    }

    toast.success(t('players.credit.queuedTitle', { amount: moved }), {
      description: t('players.credit.queuedBody', { name, amount: moved }),
    });
  };

  const send = () => {
    const sent = money;
    if (sent === null) return;

    void (async () => {
      try {
        const credit = await mutation.mutateAsync({
          playerId: player.id,
          // Minor units as a STRING, straight off the bigint. Nothing here went through Number.
          body: { amountMinor: sent.minor, reason: trimmedReason },
        });
        announce(credit);
        onCredited(credit);
      } catch (error) {
        toast.error(t('players.credit.failedTitle'), { description: errorMessage(error) });
      }
    })();
  };

  // CONFIRMATION: what was typed on the previous screen, read back in full before it is recorded.
  if (step === 'confirm' && money !== null) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>{t('players.credit.confirmTitle', { name })}</DialogTitle>
          <DialogDescription>{t('players.credit.confirmBody')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[var(--success)]/40 bg-[var(--success-muted)] p-4 text-center">
          <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('players.credit.giving')}
          </p>
          <MoneyAmount money={money} emphasis className="mt-1 text-2xl" />
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t('players.credit.toPlayer', { name })}
          </p>
        </div>

        <DetailList>
          <DetailRow label={t('field.reason')}>{trimmedReason}</DetailRow>
        </DetailList>

        {/* ERROR: the message the server sent, plus whether pressing it again is safe. */}
        {failure == null ? null : (
          <Alert
            tone="danger"
            title={
              mayTryAgain ? t('players.credit.failedTitle') : t('players.credit.maybeQueuedTitle')
            }
          >
            <p>{errorMessage(failure)}</p>
            <p className="mt-1">
              {mayTryAgain ? t('players.credit.failedHint') : t('players.credit.maybeQueuedBody')}
            </p>
          </Alert>
        )}

        {mutation.isPending ? (
          <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">
            {t('players.credit.sending')}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => {
              if (!mayTryAgain) {
                onCancel();
                return;
              }
              setStep('amount');
            }}
          >
            {mayTryAgain ? t('players.credit.back') : t('players.credit.stop')}
          </Button>
          {mayTryAgain ? (
            <Button type="button" variant="primary" loading={mutation.isPending} onClick={send}>
              {t('players.credit.confirmLabel', { amount: formatMoney(money) })}
            </Button>
          ) : null}
        </DialogFooter>
      </div>
    );
  }

  // DATA: the form itself.
  return (
    <form onSubmit={review} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('players.credit.title', { name })}</DialogTitle>
        <DialogDescription>{t('players.credit.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="credit-amount">
          {t('players.credit.amountLabel', { currency: player.currencyCode })}
        </Label>
        <Input
          id="credit-amount"
          value={amount}
          inputMode="decimal"
          autoComplete="off"
          className="tabular"
          placeholder={t('players.credit.amountPlaceholder')}
          onChange={(event) => {
            setAmount(event.target.value);
          }}
          aria-invalid={submitted && amountError !== null}
          {...(submitted && amountError !== null
            ? { 'aria-describedby': 'credit-amount-error' }
            : {})}
        />
        {submitted && amountError !== null ? (
          <p id="credit-amount-error" role="alert" className="text-sm text-[var(--danger)]">
            {amountError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="credit-reason">{t('players.credit.reasonLabel')}</Label>
        <Textarea
          id="credit-reason"
          value={reason}
          aria-required
          placeholder={t('players.credit.reasonPlaceholder')}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          aria-invalid={submitted && reasonError !== null}
          {...(submitted && reasonError !== null
            ? { 'aria-describedby': 'credit-reason-error' }
            : {})}
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('players.credit.reasonCounter', {
            length: trimmedReason.length,
            max: CREDIT_REASON_MAX_LENGTH,
          })}
        </p>
        {submitted && reasonError !== null ? (
          <p id="credit-reason-error" role="alert" className="text-sm text-[var(--danger)]">
            {reasonError}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        {/* Not "Credit": this button only moves to the confirmation. Recording it is one more,
            deliberate press away. */}
        <Button type="submit" variant="primary">
          {t('players.credit.review')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Null rather than a thrown error: an amount half-typed is not yet wrong, it is just not ready. */
function readMinor(value: string): bigint | null {
  try {
    return parseDecimalToMinor(value);
  } catch {
    return null;
  }
}

/**
 * Did this failure happen BEFORE the credit could have been queued?
 *
 * A 4xx is the server refusing on its own account — a bad amount, a role that may not credit, an
 * amount below the casino minimum. No deposit was created, so a second attempt is safe. Everything
 * else failed on the way back and says nothing about whether the deposit was recorded, so it is not
 * offered as a retry.
 */
function provablyUntouched(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}
