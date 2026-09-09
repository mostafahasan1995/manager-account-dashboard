import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import { CopyableValue } from '@/components/common/copy-button';
import { MoneyAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { TimeAgo } from '@/components/common/time';
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
import { useWithdrawal } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { AdminWithdrawal } from '@/types';

import { withdrawalMessages } from './messages';
import { WithdrawalActions } from './withdrawal-actions';
import {
  NetworkChip,
  WalletCheckChip,
  WithdrawalModeChip,
  WithdrawalStatusBadge,
} from './withdrawal-badges';
import { playerHandle, walletAvailableAsMoney } from './withdrawal-model';
import { WithdrawalTimeline } from './withdrawal-timeline';

/**
 * One withdrawal, in a panel rather than on its own page, so the queue stays behind it and
 * closing returns the reader to the row they were on.
 *
 * The open withdrawal is a search param, which makes "look at this one" a link somebody can paste
 * into the ops chat. The panel reads the row by id rather than out of the list, so a link opened
 * on a fresh tab — or a row that has paged off the list — still loads.
 */
export function WithdrawalDetailSheet({
  withdrawalId,
  onClose,
}: {
  withdrawalId: string | undefined;
  onClose: () => void;
}) {
  const { data: withdrawal, isLoading, error, refetch } = useWithdrawal(withdrawalId);
  const t = useT(withdrawalMessages);
  const enumLabel = useEnumLabel();

  return (
    <Sheet
      open={withdrawalId !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <span className="flex flex-wrap items-center gap-2">
            <SheetTitle>
              {t('withdrawals.sheet.title', { shortId: withdrawal?.shortId ?? '' })}
            </SheetTitle>
            {withdrawal === undefined ? null : <WithdrawalStatusBadge status={withdrawal.status} />}
          </span>
          <SheetDescription>
            {withdrawal === undefined
              ? t('withdrawals.sheet.loading')
              : t('withdrawals.sheet.summary', {
                  status: enumLabel('withdrawalStatus', withdrawal.status),
                  mode: enumLabel('withdrawalMode', withdrawal.mode),
                  method: withdrawal.methodName,
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

          {withdrawal === undefined ? null : <DetailBody withdrawal={withdrawal} />}
        </SheetBody>

        {withdrawal === undefined ? null : (
          <SheetFooter>
            <WithdrawalActions withdrawal={withdrawal} />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ withdrawal }: { withdrawal: AdminWithdrawal }) {
  const t = useT(withdrawalMessages);
  const handle = playerHandle(withdrawal);
  const available = walletAvailableAsMoney(withdrawal.walletCheck);
  const check = withdrawal.walletCheck;

  return (
    <>
      <Section title={t('withdrawals.section.timeline')}>
        <WithdrawalTimeline withdrawal={withdrawal} />
      </Section>

      <Section title={t('withdrawals.section.money')}>
        <DetailList>
          <DetailRow label={t('field.amount')}>
            <MoneyAmount money={withdrawal.amount} emphasis />
          </DetailRow>
          <DetailRow label={t('withdrawals.field.fee')}>
            <MoneyAmount money={withdrawal.fee} />
          </DetailRow>
          <DetailRow label={t('withdrawals.field.balanceAtRequest')}>
            <MoneyAmount money={withdrawal.balanceAtRequest} />
          </DetailRow>
          <DetailRow label={t('withdrawals.field.mode')}>
            <WithdrawalModeChip mode={withdrawal.mode} />
          </DetailRow>
        </DetailList>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {t(
            withdrawal.mode === 'AUTO'
              ? 'withdrawals.mode.autoHint'
              : 'withdrawals.mode.manualHint',
          )}
        </p>
      </Section>

      <Section title={t('withdrawals.section.payout')}>
        <DetailList>
          <DetailRow label={t('withdrawals.field.method')}>
            {withdrawal.methodName}
            <span className="ms-2 font-mono text-xs text-[var(--muted-foreground)]">
              {withdrawal.methodCode}
            </span>
          </DetailRow>
          <DetailRow label={t('withdrawals.field.payoutAddress')}>
            <CopyableValue value={withdrawal.payoutAddress} />
          </DetailRow>
          <DetailRow label={t('withdrawals.field.network')}>
            {withdrawal.payoutNetwork === null ? (
              '—'
            ) : (
              <NetworkChip network={withdrawal.payoutNetwork} />
            )}
          </DetailRow>
        </DetailList>
      </Section>

      <Section title={t('withdrawals.section.walletCheck')}>
        {check === null ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('withdrawals.walletCheck.none')}
          </p>
        ) : (
          <>
            <DetailList>
              <DetailRow label={t('field.status')}>
                <WalletCheckChip check={check} />
              </DetailRow>
              <DetailRow label={t('withdrawals.field.available')}>
                {available === null ? (
                  <span className="text-[var(--muted-foreground)]">
                    {t('withdrawals.walletCheck.noFigure')}
                  </span>
                ) : (
                  <MoneyAmount money={available} emphasis />
                )}
              </DetailRow>
              <DetailRow label={t('withdrawals.field.checkedAt')}>
                <TimeAgo value={check.checkedAt} />
              </DetailRow>
            </DetailList>
            {check.status === 'insufficient' ? (
              <Alert tone="danger" className="mt-2">
                {t('withdrawals.walletCheck.insufficientBody')}
              </Alert>
            ) : null}
          </>
        )}
      </Section>

      <Section title={t('withdrawals.section.player')}>
        <DetailList>
          <DetailRow label={t('field.player')}>
            <Link
              to="/players/$playerId"
              params={{ playerId: withdrawal.playerId }}
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              {handle.kind === 'none' ? t('withdrawals.player.open') : handle.value}
              <ExternalLink className="size-3.5" />
            </Link>
          </DetailRow>
          <DetailRow label={t('field.telegramId')}>
            {withdrawal.playerTelegramUserId === null ? (
              '—'
            ) : (
              <CopyableValue value={withdrawal.playerTelegramUserId} />
            )}
          </DetailRow>
          <DetailRow label={t('withdrawals.player.login')}>
            {withdrawal.playerIchancyLogin === null ? (
              '—'
            ) : (
              <CopyableValue value={withdrawal.playerIchancyLogin} />
            )}
          </DetailRow>
          <DetailRow label={t('withdrawals.field.source')}>
            {withdrawal.source ?? (
              <span className="text-[var(--muted-foreground)]">
                {t('withdrawals.source.unknown')}
              </span>
            )}
          </DetailRow>
        </DetailList>
      </Section>

      {withdrawal.failureCode === null && withdrawal.failureMessage === null ? null : (
        <Section title={t('withdrawals.section.failure')}>
          <Alert tone="danger">
            <DetailList>
              <DetailRow label={t('withdrawals.field.failureCode')}>
                <code className="font-mono text-xs">{withdrawal.failureCode ?? '—'}</code>
              </DetailRow>
              <DetailRow label={t('withdrawals.field.failureMessage')}>
                {withdrawal.failureMessage ?? '—'}
              </DetailRow>
            </DetailList>
          </Alert>
        </Section>
      )}

      {withdrawal.rejectionReason === null ? null : (
        <Section title={t('withdrawals.section.rejection')}>
          <p className="rounded-md bg-[var(--surface-muted)] p-3 text-sm">
            {withdrawal.rejectionReason}
          </p>
        </Section>
      )}

      <Section title={t('withdrawals.section.ledger')}>
        <DetailList>
          <DetailRow label={t('withdrawals.field.decidedBy')}>
            {withdrawal.decidedByAdminId === null ? (
              <span className="text-[var(--muted-foreground)]">
                {withdrawal.decidedAt === null
                  ? t('withdrawals.nobodyYet')
                  : t('withdrawals.platform')}
              </span>
            ) : (
              <CopyableValue value={withdrawal.decidedByAdminId} />
            )}
          </DetailRow>
          <DetailRow label={t('withdrawals.field.debitId')}>
            {withdrawal.playerDebitId === null ? (
              <span className="text-[var(--muted-foreground)]">{t('withdrawals.nobodyYet')}</span>
            ) : (
              <CopyableValue value={withdrawal.playerDebitId} />
            )}
          </DetailRow>
          <DetailRow label={t('withdrawals.field.payoutReference')}>
            {withdrawal.payoutReference === null ? (
              '—'
            ) : (
              <CopyableValue value={withdrawal.payoutReference} />
            )}
          </DetailRow>
          <DetailRow label={t('withdrawals.field.ledgerTx')}>
            {withdrawal.ledgerPayoutTxId === null ? (
              '—'
            ) : (
              <CopyableValue value={withdrawal.ledgerPayoutTxId} />
            )}
          </DetailRow>
          <DetailRow label={t('withdrawals.field.paidBy')}>
            {withdrawal.paidByAdminId === null ? (
              <span className="text-[var(--muted-foreground)]">{t('withdrawals.nobodyYet')}</span>
            ) : (
              <CopyableValue value={withdrawal.paidByAdminId} />
            )}
          </DetailRow>
          <DetailRow label={t('withdrawals.field.withdrawalId')}>
            <CopyableValue value={withdrawal.id} />
          </DetailRow>
          <DetailRow label={t('withdrawals.field.paymentMethodId')}>
            <CopyableValue value={withdrawal.paymentMethodId} />
          </DetailRow>
        </DetailList>
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
