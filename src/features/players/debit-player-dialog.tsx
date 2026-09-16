import { Banknote } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';

import { DetailList, DetailRow, EmptyState, MoneyAmount } from '@/components/common';
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
import { useDebitPlayer } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import {
  formatMinorString,
  formatMinorToDecimal,
  formatMoney,
  parseDecimalToMinor,
} from '@/lib/money';
import type { MoneyView } from '@/types/api';
import {
  DEBIT_REASON_MAX_LENGTH,
  playerDisplayName,
  type AdminPlayer,
  type PlayerDebit,
} from '@/types/player';

import { playerMessages, usePlayerEnumLabel } from './messages';

/**
 * Taking money back OUT of a player's Ichancy account.
 *
 * This is the only screen in the console that reaches into a live casino balance and removes from
 * it. Nobody asked for it — there is no player request behind a debit, no queue, and no second
 * approver — so the two things standing between a mistyped figure and somebody else's money are
 * this form and the confirmation after it. It is deliberately two steps: the amount is typed on one
 * screen and read back, in full, on the next.
 *
 * All four states live here rather than on the page: LOADING while the request is in flight (with
 * the buttons locked, because a debit is not repeatable), ERROR as an alert that also says whether
 * trying again is safe, EMPTY when the player has no Ichancy account to debit at all, and DATA as
 * the form itself.
 */
export function DebitPlayerDialog({
  player,
  open,
  onOpenChange,
  onDebited,
  onUnproven,
}: {
  player: AdminPlayer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDebited: (debit: PlayerDebit) => void;
  /** A failure that MIGHT have taken the money anyway, raised so the page can keep saying so. */
  onUnproven: (error: unknown) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every opening starts from an empty amount rather than from
            whatever the last one was. A debit form that remembers is a debit sent twice. */}
        <DebitForm
          player={player}
          onCancel={() => {
            onOpenChange(false);
          }}
          onDebited={onDebited}
          onUnproven={onUnproven}
        />
      </DialogContent>
    </Dialog>
  );
}

type Step = 'amount' | 'confirm';

function DebitForm({
  player,
  onCancel,
  onDebited,
  onUnproven,
}: {
  player: AdminPlayer;
  onCancel: () => void;
  onDebited: (debit: PlayerDebit) => void;
  onUnproven: (error: unknown) => void;
}) {
  const t = useT(playerMessages);
  const enumLabel = usePlayerEnumLabel();
  const mutation = useDebitPlayer();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const name = playerDisplayName(player);
  const typedAmount = amount.trim();
  const trimmedReason = reason.trim();

  // A bigint or nothing. The amount NEVER becomes a JavaScript number on its way to the wire: an
  // NSP figure outruns what a double holds exactly, and a debit rounded by a float is a debit for
  // the wrong amount of a real person's money.
  const minor = readMinor(typedAmount);

  const amountError =
    typedAmount.length === 0
      ? t('players.debit.amountRequired')
      : minor === null
        ? t('players.debit.amountFormat')
        : minor <= 0n
          ? t('players.debit.amountTooSmall')
          : null;

  const reasonError =
    trimmedReason.length === 0
      ? t('players.debit.reasonRequired')
      : trimmedReason.length > DEBIT_REASON_MAX_LENGTH
        ? t('players.debit.reasonTooLong', {
            max: DEBIT_REASON_MAX_LENGTH,
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

  /** Nothing moved, so the button may stay. See `provablyUntouched` at the foot of this file. */
  const mayTryAgain = failure == null || provablyUntouched(failure);

  // EMPTY: no casino account behind this player, so there is nothing to take anything out of.
  if (!player.ichancyLinked) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>{t('players.debit.title', { name })}</DialogTitle>
          <DialogDescription>{t('players.debit.description')}</DialogDescription>
        </DialogHeader>

        <EmptyState
          icon={<Banknote className="size-5" />}
          title={t('players.debit.notLinkedTitle')}
          description={t('players.debit.notLinkedBody')}
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const review = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (amountError !== null || reasonError !== null) return;
    setStep('confirm');
  };

  /** Only one of the three endings is good news, and the other two are answers, not failures. */
  const announce = (debit: PlayerDebit, sent: MoneyView) => {
    const after = formatMinorString(debit.playerBalanceAfterMinor, player.currencyCode);

    if (debit.status === 'DEBITED') {
      toast.success(t('players.debit.doneTitle', { amount: formatMoney(sent) }), {
        description: t('players.debit.doneBody', {
          name,
          before: formatMinorString(debit.playerBalanceBeforeMinor, player.currencyCode),
          after,
          amount: formatMoney(sent),
        }),
      });
      return;
    }

    if (debit.status === 'REJECTED') {
      toast.error(t('players.debit.refusedTitle'), {
        description: t('players.debit.refusedBody', { name, after }),
      });
      return;
    }

    toast.error(t('players.debit.unsureTitle'), {
      description: t('players.debit.unsureBody', {
        status: enumLabel('debit.status', debit.status),
      }),
    });
  };

  const send = () => {
    const sent = money;
    if (sent === null) return;

    void (async () => {
      try {
        const debit = await mutation.mutateAsync({
          playerId: player.id,
          // Minor units as a STRING, straight off the bigint. Nothing here went through Number.
          body: { amountMinor: sent.minor, reason: trimmedReason },
        });
        announce(debit, sent);
        onDebited(debit);
      } catch (error) {
        toast.error(t('players.debit.failedTitle'), { description: errorMessage(error) });
        // A failure the console cannot prove one way or the other has to outlive this dialog:
        // closing it must not be a way to make the warning go away.
        if (!provablyUntouched(error)) onUnproven(error);
      }
    })();
  };

  // CONFIRMATION: what was typed on the previous screen, read back in full before anything moves.
  if (step === 'confirm' && money !== null) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>{t('players.debit.confirmTitle', { name })}</DialogTitle>
          <DialogDescription>{t('players.debit.confirmBody')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-muted)] p-4 text-center">
          <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('players.debit.takingOut')}
          </p>
          <MoneyAmount money={money} emphasis className="mt-1 text-2xl" />
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t('players.debit.fromPlayer', { name })}
          </p>
        </div>

        <DetailList>
          <DetailRow label={t('field.reason')}>{trimmedReason}</DetailRow>
        </DetailList>

        <Alert tone="warning" title={t('players.debit.noUndoTitle')}>
          {t('players.debit.noUndoBody')}
        </Alert>

        {/* ERROR: the message the server sent, plus whether pressing it again is safe. */}
        {failure == null ? null : (
          <Alert
            tone="danger"
            title={
              mayTryAgain ? t('players.debit.failedTitle') : t('players.debit.maybeLandedTitle')
            }
          >
            <p>{errorMessage(failure)}</p>
            <p className="mt-1">
              {mayTryAgain ? t('players.debit.failedHint') : t('players.debit.maybeLandedBody')}
            </p>
          </Alert>
        )}

        {/* LOADING: said out loud, because this is the one request in the console nobody may
            repeat when they lose patience with it. */}
        {mutation.isPending ? (
          <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">
            {t('players.debit.sending')}
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
            {mayTryAgain ? t('players.debit.back') : t('players.debit.stop')}
          </Button>
          {mayTryAgain ? (
            <Button type="button" variant="danger" loading={mutation.isPending} onClick={send}>
              {t('players.debit.confirmLabel', { amount: formatMoney(money) })}
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
        <DialogTitle>{t('players.debit.title', { name })}</DialogTitle>
        <DialogDescription>{t('players.debit.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="debit-amount">
          {t('players.debit.amountLabel', { currency: player.currencyCode })}
        </Label>
        <Input
          id="debit-amount"
          value={amount}
          inputMode="decimal"
          autoComplete="off"
          className="tabular"
          placeholder={t('players.debit.amountPlaceholder')}
          onChange={(event) => {
            setAmount(event.target.value);
          }}
          aria-invalid={submitted && amountError !== null}
          {...(submitted && amountError !== null
            ? { 'aria-describedby': 'debit-amount-error' }
            : {})}
        />
        {submitted && amountError !== null ? (
          <p id="debit-amount-error" role="alert" className="text-sm text-[var(--danger)]">
            {amountError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="debit-reason">{t('players.debit.reasonLabel')}</Label>
        <Textarea
          id="debit-reason"
          value={reason}
          // aria-required rather than required: the browser's own bubble would pre-empt the
          // message that actually explains who reads this and when.
          aria-required
          placeholder={t('players.debit.reasonPlaceholder')}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          aria-invalid={submitted && reasonError !== null}
          {...(submitted && reasonError !== null
            ? { 'aria-describedby': 'debit-reason-error' }
            : {})}
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('players.debit.reasonCounter', {
            length: trimmedReason.length,
            max: DEBIT_REASON_MAX_LENGTH,
          })}
        </p>
        {submitted && reasonError !== null ? (
          <p id="debit-reason-error" role="alert" className="text-sm text-[var(--danger)]">
            {reasonError}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        {/* Not "Debit": this button only moves to the confirmation. The money is one more,
            deliberate press away. */}
        <Button type="submit" variant="danger">
          {t('players.debit.review')}
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
 * Did this failure happen BEFORE anything could have moved?
 *
 * A 4xx is the server refusing on its own account — a bad amount, a role that may not debit, a
 * player with no Ichancy account. It never called Ichancy, so the money is untouched and a second
 * attempt is safe.
 *
 * Everything else failed on the way BACK, which says nothing about the way in. Ichancy has no
 * idempotency key, so treating one of those as "try again" is offering to take the money twice.
 */
function provablyUntouched(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}
