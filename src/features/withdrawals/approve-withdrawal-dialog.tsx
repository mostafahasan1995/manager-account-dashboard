import { Check } from 'lucide-react';

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
import { useT } from '@/lib/i18n/use-translation';
import { formatMoney } from '@/lib/money';
import type { AdminWithdrawal } from '@/types';

import { withdrawalMessages } from './messages';
import { NetworkChip } from './withdrawal-badges';
import { playerHandle } from './withdrawal-model';

/**
 * The confirmation before a player's casino balance is taken.
 *
 * It restates the money, the player and the address, and then says — in the words of the mode the
 * request was made under — exactly what approving does and does NOT do: it starts the debit, it
 * sends nothing, and a person still has to pay. A reviewer who thinks "approve" means "paid" is
 * the failure this dialog exists to prevent.
 */
export function ApproveWithdrawalDialog({
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
  onConfirm: () => void;
}) {
  const t = useT(withdrawalMessages);
  const amount = formatMoney(withdrawal.amount);
  const handle = playerHandle(withdrawal);
  const player = handle.kind === 'none' ? t('withdrawals.player.open') : handle.value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {t('withdrawals.approve.title', { shortId: withdrawal.shortId })}
            </DialogTitle>
            <DialogDescription>
              {t('withdrawals.approve.description', {
                player,
                amount,
                method: withdrawal.methodName,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--muted-foreground)]">{t('field.amount')}</span>
              <MoneyAmount money={withdrawal.amount} emphasis />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--muted-foreground)]">
                {t('withdrawals.field.payoutAddress')}
              </span>
              <span className="flex items-center gap-1.5">
                <CopyableValue value={withdrawal.payoutAddress} />
                <NetworkChip network={withdrawal.payoutNetwork} />
              </span>
            </div>
            {withdrawal.balanceAtRequest === null ? null : (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('withdrawals.approve.balanceNote', {
                  balance: formatMoney(withdrawal.balanceAtRequest),
                })}
              </p>
            )}
          </div>

          <Alert tone={withdrawal.mode === 'AUTO' ? 'info' : 'warning'}>
            {t(
              withdrawal.mode === 'AUTO'
                ? 'withdrawals.approve.autoBody'
                : 'withdrawals.approve.manualBody',
              { amount },
            )}
          </Alert>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="success" loading={loading} onClick={onConfirm}>
              <Check className="size-4" />
              {t('withdrawals.approve.confirm', { amount })}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
