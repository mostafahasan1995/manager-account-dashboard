import { Check, Hand, RotateCw, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import {
  useApproveDeposit,
  useClaimDeposit,
  useRejectDeposit,
  useReleaseDeposit,
  useRetryCredit,
} from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useFormatters } from '@/lib/i18n/use-format';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { AdminDeposit, ApproveDepositBody, RejectDepositBody, ReviewOutcome } from '@/types';

import { ApproveDialog } from './approve-dialog';
import { claimStateOf, isDecidable, isRetryable } from './deposit-model';
import { depositMessages, type DepositTranslator } from './messages';
import { RejectDialog } from './reject-dialog';

/**
 * Everything a reviewer can do to one deposit.
 *
 * The order on screen is the order of the work: claim it, read it, decide it. Claiming is not a
 * formality — the backend hands the claim to exactly one admin, and it is the only thing standing
 * between two people at two desks approving the same receipt and paying the player twice.
 *
 * `alreadyHandled` comes back through the same success path as every other answer, because that is
 * what it is: the server telling us a colleague got there first, not a failure to report as one.
 */
export function DepositActions({ deposit }: { deposit: AdminDeposit }) {
  const { admin } = useAuth();
  const t = useT(depositMessages);
  const enumLabel = useEnumLabel();
  const formatters = useFormatters();
  const claim = useClaimDeposit();
  const release = useReleaseDeposit();
  const approve = useApproveDeposit();
  const reject = useRejectDeposit();
  const retry = useRetryCredit();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [retryReason, setRetryReason] = useState('');

  const claimState = claimStateOf(deposit, admin?.id ?? null);
  const decidable = isDecidable(deposit.status);
  const awaitingSecond = deposit.status === 'PENDING_SECOND_APPROVAL';
  // A second approval is by definition somebody other than the admin holding the claim, so that
  // one case decides without one. Everything else has to be claimed first.
  const canDecideNow = decidable && (claimState === 'you' || awaitingSecond);

  const runOutcome = async (failureTitle: string, action: () => Promise<ReviewOutcome>) => {
    try {
      announce(await action(), deposit, t, enumLabel);
      return true;
    } catch (error) {
      toast.error(failureTitle, { description: errorMessage(error) });
      return false;
    }
  };

  const handleApprove = (body: ApproveDepositBody) => {
    void (async () => {
      const done = await runOutcome(t('deposits.error.approve'), () =>
        approve.mutateAsync({ id: deposit.id, body }),
      );
      if (done) setApproveOpen(false);
    })();
  };

  const handleReject = (body: RejectDepositBody) => {
    void (async () => {
      const done = await runOutcome(t('deposits.error.reject'), () =>
        reject.mutateAsync({ id: deposit.id, body }),
      );
      if (done) setRejectOpen(false);
    })();
  };

  const handleRetry = () => {
    void (async () => {
      const reason = retryReason.trim();
      try {
        const result = await retry.mutateAsync({
          id: deposit.id,
          ...(reason.length === 0 ? {} : { reason }),
        });
        toast.success(
          t(
            result.requeued ? 'deposits.retry.queuedTitle' : 'deposits.retry.notQueuedTitle',
            { shortId: deposit.shortId },
          ),
          { description: t('deposits.retry.epochBody', { epoch: result.creditKeyEpoch }) },
        );
        setRetryOpen(false);
        setRetryReason('');
      } catch (error) {
        toast.error(t('deposits.retry.failedTitle'), { description: errorMessage(error) });
      }
    })();
  };

  return (
    <div className="space-y-3">
      <Can
        capability="deposits.decide"
        fallback={
          <p className="text-sm text-[var(--muted-foreground)]">{t('deposits.actions.readOnly')}</p>
        }
      >
        {decidable ? (
          <div className="space-y-3">
            {awaitingSecond ? (
              <Alert tone="warning" title={t('deposits.actions.secondApprovalTitle')}>
                {t('deposits.actions.secondApprovalBody')}
              </Alert>
            ) : claimState === 'other' ? (
              <Alert tone="warning" title={t('deposits.actions.otherClaimTitle')}>
                {t('deposits.actions.otherClaimBody', {
                  when: formatters.relative(deposit.reviewStartedAt),
                })}
              </Alert>
            ) : claimState === 'unclaimed' ? (
              <Alert tone="info" title={t('deposits.actions.claimFirstTitle')}>
                {t('deposits.actions.claimFirstBody')}
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {claimState === 'unclaimed' || (claimState === 'other' && !awaitingSecond) ? (
                <Button
                  variant={claimState === 'unclaimed' ? 'primary' : 'secondary'}
                  loading={claim.isPending}
                  onClick={() => {
                    void runOutcome(t('deposits.error.claim'), () =>
                      claim.mutateAsync(deposit.id),
                    );
                  }}
                >
                  <Hand className="size-4" />
                  {claimState === 'unclaimed'
                    ? t('deposits.actions.claim')
                    : t('deposits.actions.claimAnyway')}
                </Button>
              ) : null}

              {claimState === 'you' ? (
                <Button
                  variant="secondary"
                  loading={release.isPending}
                  onClick={() => {
                    void runOutcome(t('deposits.error.release'), () =>
                      release.mutateAsync(deposit.id),
                    );
                  }}
                >
                  {/* The undo glyph is read as a symbol, like a rewind mark, and is not mirrored:
                      rotating it 180° would flip the curve as well as the point. */}
                  <Undo2 className="size-4" />
                  {t('deposits.actions.release')}
                </Button>
              ) : null}

              {canDecideNow ? (
                <>
                  <Button
                    variant="success"
                    onClick={() => {
                      setApproveOpen(true);
                    }}
                  >
                    <Check className="size-4" />
                    {t('deposits.actions.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setRejectOpen(true);
                    }}
                  >
                    <X className="size-4" />
                    {t('deposits.actions.reject')}
                  </Button>
                </>
              ) : null}
            </div>

            <ApproveDialog
              deposit={deposit}
              open={approveOpen}
              onOpenChange={setApproveOpen}
              loading={approve.isPending}
              onConfirm={handleApprove}
            />
            <RejectDialog
              deposit={deposit}
              open={rejectOpen}
              onOpenChange={setRejectOpen}
              loading={reject.isPending}
              onConfirm={handleReject}
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('deposits.actions.settled', {
              status: enumLabel('depositStatus', deposit.status),
            })}
          </p>
        )}
      </Can>

      {isRetryable(deposit.status) ? (
        <Can capability="deposits.retryCredit">
          <div className="border-t border-[var(--border)] pt-3">
            <Button
              variant="secondary"
              onClick={() => {
                setRetryOpen(true);
              }}
            >
              <RotateCw className="size-4" />
              {t('deposits.retry.action')}
            </Button>
            <ConfirmDialog
              open={retryOpen}
              onOpenChange={setRetryOpen}
              title={t('deposits.retry.confirmTitle', { shortId: deposit.shortId })}
              description={t('deposits.retry.confirmBody')}
              confirmLabel={t('deposits.retry.action')}
              loading={retry.isPending}
              onConfirm={handleRetry}
            >
              <div className="space-y-1.5">
                <Label htmlFor="retry-reason">
                  {t('deposits.optionalField', {
                    label: t('field.reason'),
                    optional: t('common.optional'),
                  })}
                </Label>
                <Textarea
                  id="retry-reason"
                  value={retryReason}
                  placeholder={t('deposits.retry.notePlaceholder')}
                  onChange={(event) => {
                    setRetryReason(event.target.value);
                  }}
                />
              </div>
            </ConfirmDialog>
          </div>
        </Can>
      ) : null}
    </div>
  );
}

/** One place that turns each of the six review answers into something a person can act on. */
function announce(
  outcome: ReviewOutcome,
  deposit: AdminDeposit,
  t: DepositTranslator,
  enumLabel: (group: string, value: string) => string,
): void {
  const shortId = deposit.shortId;

  switch (outcome.kind) {
    case 'claimed':
      toast.success(t('deposits.toast.claimedTitle', { shortId }), {
        description: t('deposits.toast.claimedBody'),
      });
      return;

    case 'released':
      toast.success(t('deposits.toast.releasedTitle', { shortId }), {
        description: t('deposits.toast.releasedBody'),
      });
      return;

    case 'approved':
      toast.success(t('deposits.toast.approvedTitle', { shortId }), {
        description: t('deposits.toast.approvedBody', {
          transaction: outcome.ledgerTransactionId,
        }),
      });
      return;

    case 'awaiting_second_approval':
      toast.warning(t('deposits.toast.secondApprovalTitle'), {
        description: t('deposits.toast.secondApprovalBody', { shortId }),
      });
      return;

    case 'rejected':
      toast.success(t('deposits.toast.rejectedTitle', { shortId }), {
        description: t('deposits.toast.rejectedBody'),
      });
      return;

    case 'alreadyHandled':
      toast.info(t('deposits.toast.alreadyTitle'), {
        description:
          outcome.status === null
            ? t('deposits.toast.alreadyBodyUnknown', { shortId })
            : t('deposits.toast.alreadyBody', {
                shortId,
                status: enumLabel('depositStatus', outcome.status),
              }),
      });
      return;
  }
}
