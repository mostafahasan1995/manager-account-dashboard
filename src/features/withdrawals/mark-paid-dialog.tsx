import { ArrowLeft, BadgeCheck } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { CopyableValue } from '@/components/common/copy-button';
import { MoneyAmount } from '@/components/common/money-amount';
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
import { useT } from '@/lib/i18n/use-translation';
import { formatMoney } from '@/lib/money';
import type { AdminWithdrawal, MarkPaidBody } from '@/types';
import { PAYOUT_REFERENCE_MAX_LENGTH } from '@/types/withdrawal';

import { withdrawalMessages } from './messages';
import { NetworkChip, WalletCheckChip } from './withdrawal-badges';
import { walletAvailableAsMoney } from './withdrawal-model';

/**
 * The dialog that closes a cash-out: a person has sent the money by hand and is recording it.
 *
 * Two steps on purpose. The first shows what to send and where — amount, address, network, what
 * the payout wallet held — and takes the transfer reference. The second restates all of it in one
 * sentence and asks again, because this is the one action on the screen that posts to the ledger:
 * a reference typed against the wrong row is a payout recorded that never happened, and nothing
 * on this console can take it back.
 */
export function MarkPaidDialog({
  withdrawal,
  open,
  onOpenChange,
  loading,
  onConfirm,
}: {
  withdrawal: AdminWithdrawal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (body: MarkPaidBody) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every opening starts at step one with an empty reference. */}
        <MarkPaidForm
          withdrawal={withdrawal}
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

function MarkPaidForm({
  withdrawal,
  loading,
  onCancel,
  onConfirm,
}: {
  withdrawal: AdminWithdrawal;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (body: MarkPaidBody) => void;
}) {
  const t = useT(withdrawalMessages);
  const [reference, setReference] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const trimmed = reference.trim();
  const max = PAYOUT_REFERENCE_MAX_LENGTH;
  const error =
    trimmed.length === 0
      ? t('withdrawals.markPaid.referenceRequired')
      : trimmed.length > max
        ? t('withdrawals.markPaid.referenceTooLong', { max })
        : null;
  const showError = submitted && error !== null;

  const walletShort = withdrawal.walletCheck?.status === 'insufficient';
  const available = walletAvailableAsMoney(withdrawal.walletCheck);

  const handleContinue = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (error !== null) return;
    setConfirming(true);
  };

  if (confirming) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>{t('withdrawals.markPaid.confirmTitle')}</DialogTitle>
          <DialogDescription>
            {t('withdrawals.markPaid.confirmBody', {
              amount: formatMoney(withdrawal.amount),
              address: withdrawal.payoutAddress,
              reference: trimmed,
            })}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--muted-foreground)]">{t('field.amount')}</dt>
            <dd>
              <MoneyAmount money={withdrawal.amount} emphasis />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--muted-foreground)]">
              {t('withdrawals.field.payoutAddress')}
            </dt>
            <dd>
              <code dir="ltr" className="font-mono text-xs break-all">
                {withdrawal.payoutAddress}
              </code>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--muted-foreground)]">
              {t('withdrawals.markPaid.referenceLabel')}
            </dt>
            <dd>
              <code dir="ltr" className="font-mono text-xs break-all">
                {trimmed}
              </code>
            </dd>
          </div>
        </dl>

        {walletShort ? <Alert tone="danger">{t('withdrawals.markPaid.walletShort')}</Alert> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setConfirming(false);
            }}
            disabled={loading}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t('withdrawals.markPaid.back')}
          </Button>
          <Button
            type="button"
            variant="success"
            loading={loading}
            onClick={() => {
              onConfirm({ payoutReference: trimmed });
            }}
          >
            <BadgeCheck className="size-4" />
            {t('withdrawals.markPaid.confirm')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleContinue} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {t('withdrawals.markPaid.title', { shortId: withdrawal.shortId })}
        </DialogTitle>
        <DialogDescription>{t('withdrawals.markPaid.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--muted-foreground)]">
            {t('withdrawals.markPaid.sendThis')}
          </span>
          <MoneyAmount money={withdrawal.amount} emphasis />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--muted-foreground)]">{t('withdrawals.markPaid.toThis')}</span>
          <span className="flex items-center gap-1.5">
            <CopyableValue value={withdrawal.payoutAddress} />
            <NetworkChip network={withdrawal.payoutNetwork} />
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--muted-foreground)]">
            {t('withdrawals.field.walletCheck')}
          </span>
          <span className="flex items-center gap-2">
            {available === null ? null : <MoneyAmount money={available} />}
            <WalletCheckChip check={withdrawal.walletCheck} />
          </span>
        </div>
      </div>

      {walletShort ? (
        <Alert tone="danger">{t('withdrawals.walletCheck.insufficientBody')}</Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="payout-reference">{t('withdrawals.markPaid.referenceLabel')}</Label>
        <Input
          id="payout-reference"
          value={reference}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          className="font-mono"
          placeholder={t('withdrawals.markPaid.referencePlaceholder')}
          aria-required
          aria-invalid={showError}
          {...(showError
            ? { 'aria-describedby': 'payout-reference-error' }
            : { 'aria-describedby': 'payout-reference-hint' })}
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
        {showError ? (
          <p id="payout-reference-error" role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : (
          <p id="payout-reference-hint" className="text-xs text-[var(--muted-foreground)]">
            {t('withdrawals.markPaid.referenceHint')}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {t('withdrawals.markPaid.continue')}
        </Button>
      </DialogFooter>
    </form>
  );
}
