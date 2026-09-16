import { useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/use-translation';
import type { AdminWithdrawal, RejectWithdrawalBody } from '@/types';
import { WITHDRAWAL_REJECTION_REASON_MAX_LENGTH } from '@/types/withdrawal';

import { withdrawalMessages } from './messages';

/**
 * Rejecting a cash-out sends the player away without their money, so the reason is not optional.
 * It is what the bot tells the player, and what whoever answers the complaint reads months later.
 */
export function RejectWithdrawalDialog({
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
  onConfirm: (body: RejectWithdrawalBody) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every opening starts with an empty reason. */}
        <RejectForm
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

function RejectForm({
  withdrawal,
  loading,
  onCancel,
  onConfirm,
}: {
  withdrawal: AdminWithdrawal;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (body: RejectWithdrawalBody) => void;
}) {
  const t = useT(withdrawalMessages);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const trimmed = reason.trim();
  const max = WITHDRAWAL_REJECTION_REASON_MAX_LENGTH;
  const error =
    trimmed.length === 0
      ? t('withdrawals.reject.reasonRequired')
      : trimmed.length > max
        ? t('withdrawals.reject.reasonTooLong', { max })
        : null;
  const showError = submitted && error !== null;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (error !== null) return;
    onConfirm({ reason: trimmed });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('withdrawals.reject.title', { shortId: withdrawal.shortId })}</DialogTitle>
        <DialogDescription>{t('withdrawals.reject.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="reject-withdrawal-reason">{t('field.reason')}</Label>
        <Textarea
          id="reject-withdrawal-reason"
          value={reason}
          // aria-required rather than required: the browser's own bubble would pre-empt the
          // message that says what is missing.
          aria-required
          aria-invalid={showError}
          {...(showError ? { 'aria-describedby': 'reject-withdrawal-reason-error' } : {})}
          placeholder={t('withdrawals.reject.reasonPlaceholder')}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        <div className="flex items-start justify-between gap-3">
          {showError ? (
            <p
              id="reject-withdrawal-reason-error"
              role="alert"
              className="text-sm text-[var(--danger)]"
            >
              {error}
            </p>
          ) : (
            <span />
          )}
          <span
            className={`tabular text-xs ${trimmed.length > max ? 'text-[var(--danger)]' : 'text-[var(--muted-foreground)]'}`}
          >
            {t('withdrawals.charCount', { count: trimmed.length, max })}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="danger" loading={loading}>
          {t('withdrawals.reject.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}
