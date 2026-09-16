import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { withdrawalKeys } from '@/lib/api/query-keys';
import {
  useApproveWithdrawal,
  useMarkWithdrawalPaid,
  useRejectWithdrawal,
} from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { formatMoney } from '@/lib/money';
import type { AdminWithdrawal, MarkPaidBody, RejectWithdrawalBody } from '@/types';
import { canDecideWithdrawal, canMarkWithdrawalPaid } from '@/types/withdrawal';

import { ApproveWithdrawalDialog } from './approve-withdrawal-dialog';
import { MarkPaidDialog } from './mark-paid-dialog';
import { withdrawalMessages, type WithdrawalTranslator } from './messages';
import { RejectWithdrawalDialog } from './reject-withdrawal-dialog';
import { isInFlight, withdrawalNeedsAttention } from './withdrawal-model';

/**
 * Everything a person can do to one withdrawal.
 *
 * Three actions, each offered in exactly one state: approve and reject while REQUESTED, mark paid
 * while DEBITED. Every other state says in words why there is nothing to press — the worker has
 * it, a person must read Ichancy, or it is settled — so an empty footer never has to be guessed
 * at.
 *
 * A `409 WITHDRAWAL_INVALID_STATE` comes back through the same path a success would: it is the
 * server saying a colleague got there first, and the right answer is to show them the row as it
 * now is, not to report their click as broken.
 */
export function WithdrawalActions({ withdrawal }: { withdrawal: AdminWithdrawal }) {
  const t = useT(withdrawalMessages);
  const enumLabel = useEnumLabel();
  const queryClient = useQueryClient();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();
  const markPaid = useMarkWithdrawalPaid();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  const decidable = canDecideWithdrawal(withdrawal);
  const payable = canMarkWithdrawalPaid(withdrawal);

  const run = async (failureTitle: string, action: () => Promise<AdminWithdrawal>) => {
    try {
      announce(await action(), t, enumLabel);
      return true;
    } catch (error) {
      if (isApiError(error) && error.isConflict) {
        toast.info(t('withdrawals.toast.alreadyTitle'), {
          description: t('withdrawals.toast.alreadyBody', { shortId: withdrawal.shortId }),
        });
        // A failed mutation invalidates nothing on its own; the panel has to catch up by hand.
        await queryClient.invalidateQueries({ queryKey: withdrawalKeys.all });
        return true;
      }
      toast.error(failureTitle, { description: errorMessage(error) });
      return false;
    }
  };

  const handleApprove = () => {
    void (async () => {
      const done = await run(t('withdrawals.error.approve'), () =>
        approve.mutateAsync(withdrawal.id),
      );
      if (done) setApproveOpen(false);
    })();
  };

  const handleReject = (body: RejectWithdrawalBody) => {
    void (async () => {
      const done = await run(t('withdrawals.error.reject'), () =>
        reject.mutateAsync({ id: withdrawal.id, body }),
      );
      if (done) setRejectOpen(false);
    })();
  };

  const handleMarkPaid = (body: MarkPaidBody) => {
    void (async () => {
      const done = await run(t('withdrawals.error.markPaid'), () =>
        markPaid.mutateAsync({ id: withdrawal.id, body }),
      );
      if (done) setMarkPaidOpen(false);
    })();
  };

  return (
    <Can
      capability="withdrawals.decide"
      fallback={
        <p className="text-sm text-[var(--muted-foreground)]">
          {t('withdrawals.actions.readOnly')}
        </p>
      }
    >
      <div className="w-full space-y-3">
        {decidable ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="success"
                onClick={() => {
                  setApproveOpen(true);
                }}
              >
                <Check className="size-4" />
                {t('withdrawals.actions.approve')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setRejectOpen(true);
                }}
              >
                <X className="size-4" />
                {t('withdrawals.actions.reject')}
              </Button>
            </div>
            <ApproveWithdrawalDialog
              withdrawal={withdrawal}
              open={approveOpen}
              onOpenChange={setApproveOpen}
              loading={approve.isPending}
              onConfirm={handleApprove}
            />
            <RejectWithdrawalDialog
              withdrawal={withdrawal}
              open={rejectOpen}
              onOpenChange={setRejectOpen}
              loading={reject.isPending}
              onConfirm={handleReject}
            />
          </>
        ) : payable ? (
          <>
            <Alert tone="warning" title={t('withdrawals.actions.debitedTitle')}>
              {t('withdrawals.actions.debitedBody', { amount: formatMoney(withdrawal.amount) })}
            </Alert>
            <Button
              variant="primary"
              onClick={() => {
                setMarkPaidOpen(true);
              }}
            >
              <BadgeCheck className="size-4" />
              {t('withdrawals.actions.markPaid')}
            </Button>
            <MarkPaidDialog
              withdrawal={withdrawal}
              open={markPaidOpen}
              onOpenChange={setMarkPaidOpen}
              loading={markPaid.isPending}
              onConfirm={handleMarkPaid}
            />
          </>
        ) : isInFlight(withdrawal.status) ? (
          <Alert tone="info" title={t('withdrawals.actions.inFlightTitle')}>
            {t('withdrawals.actions.inFlightBody')}
          </Alert>
        ) : withdrawalNeedsAttention(withdrawal.status) ? (
          <Alert tone="danger" title={t('withdrawals.actions.attentionTitle')}>
            {t('withdrawals.actions.attentionBody')}
          </Alert>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('withdrawals.actions.settled', {
              status: enumLabel('withdrawalStatus', withdrawal.status),
            })}
          </p>
        )}
      </div>
    </Can>
  );
}

/**
 * One place that turns the row the server handed back into something a person can act on.
 *
 * The server answers every action with the row as it now is, so the STATUS is the outcome: an
 * approval may land as APPROVED (the worker will debit), as DEBITED (it already has), or as a
 * refused debit — and each of those is a different next thing to do.
 */
function announce(
  result: AdminWithdrawal,
  t: WithdrawalTranslator,
  enumLabel: (group: string, value: string) => string,
): void {
  const shortId = result.shortId;

  switch (result.status) {
    case 'APPROVED':
    case 'DEBITING':
      toast.success(t('withdrawals.toast.approvedTitle', { shortId }), {
        description: t('withdrawals.toast.approvedBody'),
      });
      return;

    case 'DEBITED':
      toast.warning(t('withdrawals.toast.debitedTitle', { shortId }), {
        description: t('withdrawals.toast.debitedBody', {
          amount: formatMoney(result.amount),
          walletCheck:
            result.walletCheck === null
              ? t('withdrawals.walletCheck.notTaken')
              : enumLabel('walletCheckStatus', result.walletCheck.status),
        }),
      });
      return;

    case 'DEBIT_FAILED':
      toast.error(t('withdrawals.toast.debitFailedTitle', { shortId }), {
        description: t('withdrawals.toast.debitFailedBody', {
          message: result.failureMessage ?? result.failureCode ?? '',
        }),
      });
      return;

    case 'NEEDS_RECONCILIATION':
      toast.error(t('withdrawals.toast.reconcileTitle', { shortId }), {
        description: t('withdrawals.toast.reconcileBody'),
      });
      return;

    case 'REJECTED':
      toast.success(t('withdrawals.toast.rejectedTitle', { shortId }), {
        description: t('withdrawals.toast.rejectedBody'),
      });
      return;

    case 'PAID':
      toast.success(t('withdrawals.toast.paidTitle', { shortId }), {
        description: t('withdrawals.toast.paidBody', {
          transaction: result.ledgerPayoutTxId ?? '—',
        }),
      });
      return;

    case 'REQUESTED':
    case 'CANCELLED':
      toast.info(
        t('withdrawals.toast.changedTitle', {
          shortId,
          status: enumLabel('withdrawalStatus', result.status),
        }),
        { description: t('withdrawals.toast.changedBody') },
      );
      return;
  }
}
