import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import { CopyableValue } from '@/components/common/copy-button';
import { MoneyAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { RiskFlagList } from '@/components/common/risk-flags';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { DepositStatusBadge } from '@/components/common/status-badge';
import { Countdown, TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDeposit } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { differsFrom, formatMoney } from '@/lib/money';
import type { AdminDeposit } from '@/types';

import { DepositActions } from './deposit-actions';
import { isRetryable } from './deposit-model';
import { DepositProofs } from './deposit-proofs';
import { depositMessages, useDepositEnumLabel } from './messages';

/**
 * Review, in a panel rather than on its own page, so the queue stays behind it and closing returns
 * the reviewer to the row they were on.
 *
 * The open deposit is a search param, which makes "look at this one" a link somebody can paste into
 * the ops chat — the single most common thing a reviewer asks a colleague to do.
 */
export function DepositReviewSheet({
  depositId,
  onClose,
}: {
  depositId: string | undefined;
  onClose: () => void;
}) {
  const { data: deposit, isLoading, error, refetch } = useDeposit(depositId);
  const t = useT(depositMessages);
  const enumLabel = useEnumLabel();

  return (
    <Sheet
      open={depositId !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <span className="flex flex-wrap items-center gap-2">
            <SheetTitle>{t('deposits.sheet.title', { shortId: deposit?.shortId ?? '' })}</SheetTitle>
            {deposit === undefined ? null : <DepositStatusBadge status={deposit.status} />}
          </span>
          <SheetDescription>
            {deposit === undefined
              ? t('deposits.sheet.loading')
              : t('deposits.sheet.summary', {
                  status: enumLabel('depositStatus', deposit.status),
                  proofs: t('deposits.proofCount', { count: deposit.proofCount }),
                })}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {isLoading ? <CardSkeleton /> : null}

          {error === null ? null : (
            <ErrorState
              error={error}
              onRetry={() => {
                void refetch();
              }}
            />
          )}

          {deposit === undefined ? null : <ReviewBody deposit={deposit} />}
        </SheetBody>

        {deposit === undefined ? null : (
          <SheetFooter>
            <DepositActions deposit={deposit} />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReviewBody({ deposit }: { deposit: AdminDeposit }) {
  const t = useT(depositMessages);
  const enumLabel = useEnumLabel();
  const depositEnumLabel = useDepositEnumLabel();

  const amountsDiffer = differsFrom(deposit.verified, deposit.claimed);
  const destination = deposit.destination;

  return (
    <>
      {amountsDiffer ? (
        <Alert tone="warning" title={t('deposits.sheet.mismatchTitle')}>
          {t('deposits.sheet.mismatchBody', {
            claimed: formatMoney(deposit.claimed),
            verified: formatMoney(deposit.verified),
          })}
        </Alert>
      ) : null}

      <Section title={t('deposits.section.money')}>
        <DetailList>
          <DetailRow label={t('deposits.field.claimed')}>
            <MoneyAmount money={deposit.claimed} emphasis />
          </DetailRow>
          <DetailRow label={t('deposits.field.verified')}>
            <MoneyAmount money={deposit.verified} />
          </DetailRow>
          <DetailRow label={t('deposits.field.credited')}>
            <MoneyAmount money={deposit.credited} />
          </DetailRow>
          <DetailRow label={t('deposits.field.fee')}>
            <MoneyAmount money={deposit.fee} />
          </DetailRow>
        </DetailList>
      </Section>

      <Section title={t('deposits.section.destination')}>
        {destination === null ? (
          <p className="text-sm text-[var(--muted-foreground)]">{t('deposits.destination.gone')}</p>
        ) : (
          <>
            <DetailList>
              <DetailRow label={t('deposits.field.method')}>
                {destination.methodName}
                <span className="ms-2 font-mono text-xs text-[var(--muted-foreground)]">
                  {destination.methodCode}
                </span>
              </DetailRow>
              <DetailRow label={t('deposits.field.destination')}>
                {destination.label ?? '—'}
              </DetailRow>
              <DetailRow label={t('deposits.field.account')}>
                {destination.accountIdentifier === null ? (
                  '—'
                ) : (
                  <CopyableValue value={destination.accountIdentifier} />
                )}
              </DetailRow>
              <DetailRow label={t('deposits.field.accountHolder')}>
                {destination.accountHolder ?? '—'}
              </DetailRow>
              <DetailRow label={t('deposits.field.referenceRequired')}>
                {destination.requiresReference ? t('common.yes') : t('common.no')}
              </DetailRow>
            </DetailList>
            {destination.instructions === null ? null : (
              <p className="mt-2 rounded-md bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted-foreground)]">
                {destination.instructions}
              </p>
            )}
          </>
        )}
      </Section>

      <Section title={t('deposits.section.sender')}>
        <DetailList>
          <DetailRow label={t('deposits.field.reference')}>
            {deposit.externalReference === null ? (
              <span className="text-[var(--muted-foreground)]">{t('deposits.reference.none')}</span>
            ) : (
              <CopyableValue value={deposit.externalReference} />
            )}
          </DetailRow>
          <DetailRow label={t('deposits.field.sender')}>{deposit.senderAccount ?? '—'}</DetailRow>
          <DetailRow label={t('field.player')}>
            <Link
              to="/players/$playerId"
              params={{ playerId: deposit.playerId }}
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              {deposit.playerTelegramUsername === null
                ? t('deposits.player.open')
                : `@${deposit.playerTelegramUsername}`}
              <ExternalLink className="size-3.5" />
            </Link>
          </DetailRow>
          <DetailRow label={t('field.telegramId')}>
            {deposit.playerTelegramUserId === null ? (
              '—'
            ) : (
              <CopyableValue value={deposit.playerTelegramUserId} />
            )}
          </DetailRow>
        </DetailList>
      </Section>

      <Section title={t('deposits.field.risk')}>
        <RiskFlagList flags={deposit.riskFlags} />
      </Section>

      <Section title={t('deposits.section.decision')}>
        <DetailList>
          <DetailRow label={t('deposits.field.secondApprovalNeeded')}>
            {deposit.requiresSecondApproval ? t('common.yes') : t('common.no')}
          </DetailRow>
          <DetailRow label={t('deposits.field.decidedBy')}>
            {/* An admin id rather than a name: a reviewer cannot read the staff directory, and a
                blank here would hide who to ask. */}
            {deposit.decidedByAdminId === null ? (
              <span className="text-[var(--muted-foreground)]">{t('deposits.nobodyYet')}</span>
            ) : (
              <CopyableValue value={deposit.decidedByAdminId} />
            )}
          </DetailRow>
          <DetailRow label={t('deposits.field.secondApprover')}>
            {deposit.secondApproverAdminId === null ? (
              <span className="text-[var(--muted-foreground)]">{t('deposits.nobodyYet')}</span>
            ) : (
              <CopyableValue value={deposit.secondApproverAdminId} />
            )}
          </DetailRow>
        </DetailList>
      </Section>

      {isRetryable(deposit.status) || deposit.creditAttempts > 0 ? (
        <Section title={t('deposits.section.credit')}>
          <DetailList>
            <DetailRow label={t('deposits.field.attempts')}>
              <span className="tabular">{deposit.creditAttempts}</span>
            </DetailRow>
            <DetailRow label={t('deposits.field.verifiedBy')}>
              {deposit.creditVerifiedBy === null
                ? t('deposits.creditVerifiedBy.unconfirmed')
                : depositEnumLabel('creditVerifiedBy', deposit.creditVerifiedBy)}
            </DetailRow>
            <DetailRow label={t('deposits.field.creditKeyEpoch')}>
              <span className="tabular">{deposit.creditKeyEpoch}</span>
            </DetailRow>
          </DetailList>
          {isRetryable(deposit.status) ? (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {t('deposits.credit.epochHint')}
            </p>
          ) : null}
        </Section>
      ) : null}

      {deposit.rejectionCode === null ? null : (
        <Section title={t('deposits.section.rejection')}>
          <DetailList>
            <DetailRow label={t('field.reason')}>
              {enumLabel('rejectionCode', deposit.rejectionCode)}
            </DetailRow>
            <DetailRow label={t('field.note')}>
              {deposit.rejectionNote ?? (
                <span className="text-[var(--muted-foreground)]">
                  {t('deposits.rejection.noNote')}
                </span>
              )}
            </DetailRow>
          </DetailList>
        </Section>
      )}

      <Section title={t('deposits.section.timeline')}>
        <DetailList>
          <DetailRow label={t('field.created')}>
            <TimeAgo value={deposit.createdAt} />
          </DetailRow>
          <DetailRow label={t('deposits.field.submitted')}>
            <TimeAgo value={deposit.submittedAt} />
          </DetailRow>
          <DetailRow label={t('deposits.field.reviewStarted')}>
            <TimeAgo value={deposit.reviewStartedAt} />
          </DetailRow>
          <DetailRow label={t('deposits.field.decided')}>
            <TimeAgo value={deposit.decidedAt} />
          </DetailRow>
          <DetailRow label={t('deposits.field.creditedAt')}>
            <TimeAgo value={deposit.creditedAt} />
          </DetailRow>
          <DetailRow label={t('deposits.field.expires')}>
            {deposit.expiresAt === null ? (
              <span className="text-[var(--muted-foreground)]">{t('deposits.expiry.none')}</span>
            ) : (
              <Countdown target={deposit.expiresAt} />
            )}
          </DetailRow>
          <DetailRow label={t('deposits.field.depositId')}>
            <CopyableValue value={deposit.id} />
          </DetailRow>
          <DetailRow label={t('deposits.field.paymentMethodId')}>
            <CopyableValue value={deposit.paymentMethodId} />
          </DetailRow>
        </DetailList>
      </Section>

      <Section title={t('deposits.section.proofs', { count: deposit.proofs.length })}>
        <DepositProofs depositId={deposit.id} shortId={deposit.shortId} proofs={deposit.proofs} />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
