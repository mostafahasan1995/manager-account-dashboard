import { useState, type SyntheticEvent } from 'react';

import { MinorAmount, MoneyAmount } from '@/components/common/money-amount';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { useDepositChainCheck } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import {
  differsFrom,
  formatMinorToDecimal,
  formatMoney,
  minorFromString,
  parseDecimalToMinor,
  toMoneyBody,
} from '@/lib/money';
import type { AdminDeposit, ApproveDepositBody, DepositChainCheck, MoneyView } from '@/types';

import { arrivedAsMoney } from './chain-money';
import { depositMessages } from './messages';

/**
 * The last thing between a reviewer and somebody else's money.
 *
 * The verified amount is pre-filled with what the player claimed, so the common case is one click.
 * The moment it stops matching, the difference is spelled out in words and figures before the
 * button can be pressed — an approval typed one zero out is not recoverable from this console.
 */
export function ApproveDialog({
  deposit,
  open,
  onOpenChange,
  loading,
  onConfirm,
}: {
  deposit: AdminDeposit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (body: ApproveDepositBody) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every opening starts from the claimed amount again. */}
        <ApproveForm
          deposit={deposit}
          loading={loading}
          onCancel={() => {
            onOpenChange(false);
          }}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

function ApproveForm({
  deposit,
  loading,
  onCancel,
  onConfirm,
}: {
  deposit: AdminDeposit;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (body: ApproveDepositBody) => void;
}) {
  const t = useT(depositMessages);
  const [amount, setAmount] = useState(deposit.claimed.amount);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Same query key the review panel behind this dialog already holds, so opening the dialog costs
  // no second chain read. Mounted with the form rather than with the dialog, so a reviewer who
  // never opens it never asks.
  const chainOffer = creditableOffer(useDepositChainCheck(deposit.id).data, deposit.claimed);

  const claimedMinor = minorFromString(deposit.claimed.minor);
  const verifiedMinor = readMinor(amount);
  const player =
    deposit.playerTelegramUsername === null
      ? (deposit.playerTelegramUserId ?? t('deposits.approve.thisPlayer'))
      : `@${deposit.playerTelegramUsername}`;

  const amountError =
    verifiedMinor === null
      ? t('deposits.amountFormat')
      : verifiedMinor <= 0n
        ? t('deposits.approve.amountTooSmall')
        : null;

  const verified: MoneyView | null =
    verifiedMinor === null
      ? null
      : {
          minor: verifiedMinor.toString(),
          amount: formatMinorToDecimal(verifiedMinor),
          currency: deposit.claimed.currency,
        };

  const deltaMinor = verifiedMinor === null ? null : verifiedMinor - claimedMinor;
  const changed = deltaMinor !== null && deltaMinor !== 0n;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (amountError !== null || verified === null) return;

    const trimmedNote = note.trim();
    onConfirm({
      // Only sent when the reviewer actually changed it — an unchanged amount is the backend's own
      // default, and echoing it back would make every approval look like a correction.
      ...(changed ? { verifiedAmount: toMoneyBody(verified.amount, verified.currency) } : {}),
      ...(trimmedNote.length === 0 ? {} : { note: trimmedNote }),
    });
  };

  // The difference stays its own element so it keeps the tabular figures the rest of the sentence
  // does not need; the sentence is one string with `{delta}` wherever the language wants it.
  const [beforeDelta, afterDelta] = t('deposits.approve.changedBody').split('{delta}');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('deposits.approve.title', { shortId: deposit.shortId })}</DialogTitle>
        <DialogDescription>{t('deposits.approve.description', { player })}</DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--muted-foreground)]">
            {t('deposits.approve.playerClaimed')}
          </span>
          <MoneyAmount money={deposit.claimed} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-4">
          <span className="text-[var(--muted-foreground)]">
            {t('deposits.approve.youAreApproving')}
          </span>
          {verified === null ? (
            <span className="text-[var(--danger)]">—</span>
          ) : (
            <MoneyAmount money={verified} emphasis />
          )}
        </div>
      </div>

      {changed ? (
        <Alert tone="warning" title={t('deposits.approve.changedTitle')}>
          {beforeDelta ?? ''}
          <MinorAmount minor={deltaMinor.toString()} currency={deposit.claimed.currency} signed />
          {afterDelta ?? ''}
        </Alert>
      ) : null}

      {deposit.requiresSecondApproval ? (
        <Alert tone="info" title={t('deposits.approve.secondTitle')}>
          {t('deposits.approve.secondBody', { player })}
        </Alert>
      ) : null}

      {chainOffer === null ? null : (
        <Alert tone="warning" title={t('deposits.approve.chainTitle')}>
          <p>
            {t('deposits.approve.chainBody', {
              arrived: formatMoney(chainOffer.arrived),
              creditable: formatMoney(chainOffer.creditable),
            })}
          </p>
          {/*
           * A BUTTON, never a pre-filled value. Read the comment beside `verifiedAmount` in
           * handleSubmit: the amount is sent only when a human changed it, because an unchanged
           * amount is the backend's own default and echoing it would file every approval as a
           * correction. A field this dialog filled in by itself would be indistinguishable from one
           * the reviewer typed — the console would then be quietly authoring corrections and
           * signing them with somebody's name.
           */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => {
              setAmount(chainOffer.creditable.amount);
            }}
          >
            {t('deposits.approve.useChainAmount', { amount: formatMoney(chainOffer.creditable) })}
          </Button>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="approve-amount">
          {t('deposits.approve.amountLabel', { currency: deposit.claimed.currency })}
        </Label>
        <Input
          id="approve-amount"
          value={amount}
          inputMode="decimal"
          autoComplete="off"
          className="tabular"
          onChange={(event) => {
            setAmount(event.target.value);
          }}
          aria-invalid={submitted && amountError !== null}
          {...(submitted && amountError !== null
            ? { 'aria-describedby': 'approve-amount-error' }
            : {})}
        />
        {submitted && amountError !== null ? (
          <p id="approve-amount-error" role="alert" className="text-sm text-[var(--danger)]">
            {amountError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="approve-note">
          {t('deposits.optionalField', {
            label: t('field.note'),
            optional: t('common.optional'),
          })}
        </Label>
        <Textarea
          id="approve-note"
          value={note}
          placeholder={t('deposits.approve.notePlaceholder')}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="success" loading={loading}>
          {verified === null
            ? t('deposits.approve.confirm')
            : t('deposits.approve.confirmAmount', { amount: formatMoney(verified) })}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * The chain's own figure, when it is worth offering — and null the rest of the time.
 *
 * Three gates, each of which would otherwise put a wrong or pointless number under a reviewer's
 * cursor:
 *
 *   1. **There has to be a creditable amount.** `suspect` and `pending` deliberately carry none:
 *      one paid somebody else and the other has not confirmed, and a figure beside either reads as
 *      permission to approve it.
 *   2. **The currency has to match the deposit.** A different one in this box would be approved as
 *      if it were NSP.
 *   3. **It has to differ from what the player claimed.** When the chain agrees with the claim the
 *      field already holds that number, and a button that sets a field to what it already contains
 *      is a control that does nothing — beside a money input, that is worse than no control.
 *
 * The arrived USDT travels with it because the sentence needs both halves: `99.500000 USDT` is the
 * fact, and the NSP figure is only what it is worth at today's rate.
 */
function creditableOffer(
  verdict: DepositChainCheck | undefined,
  claimed: MoneyView,
): { creditable: MoneyView; arrived: MoneyView | null } | null {
  const creditable = verdict?.creditable;
  // One condition for the first two gates: no verdict yet, no creditable figure in it, and a figure
  // priced in some other currency all come to the same answer — there is nothing to put in the box.
  if (creditable?.currency !== claimed.currency) return null;
  if (!differsFrom(creditable, claimed)) return null;

  return { creditable, arrived: arrivedAsMoney(verdict?.arrived ?? null) };
}

/** Null rather than a thrown error: an amount half-typed is not yet wrong, it is just not ready. */
function readMinor(value: string): bigint | null {
  try {
    return parseDecimalToMinor(value.trim());
  } catch {
    return null;
  }
}
